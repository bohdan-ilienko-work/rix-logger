import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { PetEvent, PetEventType, PetEventValue } from './entities/pet-event.entity';
import { EventImage } from './entities/event-image.entity';

export interface CreatePetEventInput {
    owner: User;
    pet?: Pet | null;
    type: PetEventType;
    value?: PetEventValue | null;
}

@Injectable()
export class PetEventsService {
    constructor(
        @InjectRepository(PetEvent)
        private readonly petEventsRepository: Repository<PetEvent>,
        @InjectRepository(EventImage)
        private readonly eventImagesRepository: Repository<EventImage>,
    ) { }

    async createEvent(payload: CreatePetEventInput): Promise<PetEvent> {
        const event = this.petEventsRepository.create({
            owner: payload.owner,
            pet: payload.pet ?? null,
            type: payload.type,
            value: payload.value ?? null,
        });

        return this.petEventsRepository.save(event);
    }

    async findById(id: string): Promise<PetEvent | null> {
        return this.petEventsRepository.findOne({
            where: { id },
            relations: ['owner', 'pet', 'images'],
        });
    }

    async updateEvent(event: PetEvent, value: PetEventValue | null, type?: PetEventType, createdAt?: Date): Promise<PetEvent> {
        event.value = value;
        if (type) event.type = type;
        if (createdAt) event.createdAt = createdAt;
        return this.petEventsRepository.save(event);
    }

    async deleteEvent(event: PetEvent): Promise<void> {
        await this.petEventsRepository.remove(event);
    }

    async getEventsForPetInRange(user: User, petId: string, from: Date, to: Date): Promise<PetEvent[]> {
        return this.petEventsRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.pet', 'pet')
            .leftJoin('event.images', 'images')
            .addSelect(['images.id'])
            .leftJoin('pet.memberships', 'membership')
            .where('event.createdAt BETWEEN :from AND :to', { from, to })
            .andWhere('pet.id = :petId', { petId })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('membership.userId = :userId', { userId: user.id })
                        .orWhere('event.ownerId = :userId', { userId: user.id });
                }),
            )
            .orderBy('event.createdAt', 'ASC')
            .getMany();
    }

    async getTodayEventsForUser(owner: User): Promise<PetEvent[]> {
        const since = new Date();
        since.setHours(since.getHours() - 24);

        return this.petEventsRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.pet', 'pet')
            .leftJoin('event.images', 'images')
            .addSelect(['images.id'])
            .leftJoin('pet.memberships', 'membership')
            .where('event.createdAt >= :since', { since })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('membership.userId = :userId', { userId: owner.id })
                        .orWhere('event.ownerId = :userId', { userId: owner.id });
                }),
            )
            .orderBy('event.createdAt', 'ASC')
            .getMany();
    }

    // ─── Event images ───

    async addImage(event: PetEvent, data: Buffer, mime: string): Promise<EventImage> {
        const img = this.eventImagesRepository.create({ event, data, mime });
        return this.eventImagesRepository.save(img);
    }

    async countImages(eventId: string): Promise<number> {
        return this.eventImagesRepository.count({ where: { event: { id: eventId } } });
    }

    async findImageById(imageId: string): Promise<EventImage | null> {
        return this.eventImagesRepository.findOne({
            where: { id: imageId },
            relations: ['event', 'event.owner'],
        });
    }

    async listImageIds(eventId: string): Promise<{ id: string }[]> {
        return this.eventImagesRepository.find({
            where: { event: { id: eventId } },
            select: ['id'],
            order: { createdAt: 'ASC' },
        });
    }

    async deleteImage(image: EventImage): Promise<void> {
        await this.eventImagesRepository.remove(image);
    }
}
