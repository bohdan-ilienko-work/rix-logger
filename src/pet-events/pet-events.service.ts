import { Injectable, Logger } from '@nestjs/common';
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
    private readonly logger = new Logger(PetEventsService.name);

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

        const saved = await this.petEventsRepository.save(event);
        this.logger.log(`Created event=${saved.id} type=${payload.type} owner=${payload.owner.id} pet=${payload.pet?.id ?? 'none'}`);
        return saved;
    }

    async findById(id: string): Promise<PetEvent | null> {
        const event = await this.petEventsRepository.findOne({
            where: { id },
            relations: ['owner', 'pet', 'images'],
        });
        this.logger.debug(`findById event=${id} found=${!!event}`);
        return event;
    }

    async updateEvent(event: PetEvent, value: PetEventValue | null, type?: PetEventType, createdAt?: Date): Promise<PetEvent> {
        event.value = value;
        if (type) event.type = type;
        if (createdAt) event.createdAt = createdAt;
        const saved = await this.petEventsRepository.save(event);
        this.logger.log(`Updated event=${event.id} type=${saved.type}`);
        return saved;
    }

    async deleteEvent(event: PetEvent): Promise<void> {
        const id = event.id;
        await this.petEventsRepository.remove(event);
        this.logger.log(`Deleted event=${id}`);
    }

    async getEventsForPetInRange(user: User, petId: string, from: Date, to: Date): Promise<PetEvent[]> {
        const events = await this.petEventsRepository
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
            .orderBy('event.createdAt', 'DESC')
            .getMany();
        this.logger.debug(`getEventsForPetInRange pet=${petId} user=${user.id} from=${from.toISOString()} to=${to.toISOString()} count=${events.length}`);
        return events;
    }

    async getTodayEventsForUser(owner: User): Promise<PetEvent[]> {
        const since = new Date();
        since.setHours(since.getHours() - 24);

        const events = await this.petEventsRepository
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
            .orderBy('event.createdAt', 'DESC')
            .getMany();
        this.logger.debug(`getTodayEventsForUser user=${owner.id} count=${events.length}`);
        return events;
    }

    async getEventsForUserSince(owner: User, since: Date): Promise<PetEvent[]> {
        const events = await this.petEventsRepository
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
            .orderBy('event.createdAt', 'DESC')
            .getMany();
        this.logger.debug(`getEventsForUserSince user=${owner.id} since=${since.toISOString()} count=${events.length}`);
        return events;
    }

    // ─── Event images ───

    async addImage(event: PetEvent, data: Buffer, mime: string): Promise<EventImage> {
        const img = this.eventImagesRepository.create({ event, data, mime });
        const saved = await this.eventImagesRepository.save(img);
        this.logger.log(`Added image=${saved.id} to event=${event.id} mime=${mime} size=${data.length}`);
        return saved;
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
        const id = image.id;
        await this.eventImagesRepository.remove(image);
        this.logger.log(`Deleted image=${id}`);
    }
}
