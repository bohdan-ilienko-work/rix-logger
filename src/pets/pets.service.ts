import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Pet } from './entities/pet.entity';
import { PetMember, PetMemberRole } from './entities/pet-member.entity';
import { PetInvite } from './entities/pet-invite.entity';

export interface CreatePetInput {
    name: string;
    age?: string | null;
    breed?: string | null;
    weightKg?: number | null;
    note?: string | null;
}

export interface AddPetMemberInput {
    pet: Pet;
    user: User;
    role: PetMemberRole;
    tag?: string | null;
}

export interface PetMemberView {
    id: string;
    role: PetMemberRole;
    tag: string | null;
    user: {
        id: string;
        telegramId: string;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
    };
}

export interface DeletePetResult {
    deleted: boolean;
}

@Injectable()
export class PetsService {
    constructor(
        @InjectRepository(Pet)
        private readonly petsRepository: Repository<Pet>,
        @InjectRepository(PetMember)
        private readonly petMembersRepository: Repository<PetMember>,
        @InjectRepository(PetInvite)
        private readonly petInvitesRepository: Repository<PetInvite>,
    ) { }

    async createForUser(owner: User, payload: CreatePetInput): Promise<Pet> {
        const pet = this.petsRepository.create({
            owner,
            name: payload.name,
            age: payload.age ?? null,
            breed: payload.breed ?? null,
            weightKg:
                payload.weightKg === null || payload.weightKg === undefined
                    ? null
                    : payload.weightKg.toFixed(2),
            note: payload.note ?? null,
        });

        const savedPet = await this.petsRepository.save(pet);

        await this.addOrUpdateMember({
            pet: savedPet,
            user: owner,
            role: PetMemberRole.OWNER,
            tag: 'primary',
        });

        return savedPet;
    }

    async addOrUpdateMember(payload: AddPetMemberInput): Promise<PetMember> {
        const existing = await this.petMembersRepository.findOne({
            where: {
                pet: { id: payload.pet.id },
                user: { id: payload.user.id },
            },
            relations: ['pet', 'user'],
        });

        if (existing) {
            existing.role = payload.role;
            existing.tag = payload.tag ?? null;
            return this.petMembersRepository.save(existing);
        }

        const membership = this.petMembersRepository.create({
            pet: payload.pet,
            user: payload.user,
            role: payload.role,
            tag: payload.tag ?? null,
        });

        return this.petMembersRepository.save(membership);
    }

    async deletePet(pet: Pet): Promise<DeletePetResult> {
        await this.petsRepository.remove(pet);
        return { deleted: true };
    }

    async updatePet(pet: Pet, payload: Partial<CreatePetInput>): Promise<Pet> {
        if (payload.name !== undefined) pet.name = payload.name;
        if (payload.age !== undefined) pet.age = payload.age ?? null;
        if (payload.breed !== undefined) pet.breed = payload.breed ?? null;
        if (payload.weightKg !== undefined) {
            pet.weightKg = payload.weightKg === null || payload.weightKg === undefined
                ? null : payload.weightKg.toFixed(2);
        }
        if (payload.note !== undefined) pet.note = payload.note ?? null;
        return this.petsRepository.save(pet);
    }

    async updateMemberRole(pet: Pet, userId: string, role: PetMemberRole, tag?: string | null): Promise<PetMember | null> {
        const membership = await this.petMembersRepository.findOne({
            where: { pet: { id: pet.id }, user: { id: userId } },
            relations: ['pet', 'user'],
        });
        if (!membership) return null;
        membership.role = role;
        if (tag !== undefined) membership.tag = tag;
        return this.petMembersRepository.save(membership);
    }

    async findFirstByUser(owner: User): Promise<Pet | null> {
        return this.petsRepository.findOne({
            where: [
                { memberships: { user: { id: owner.id } } },
                { owner: { id: owner.id } },
            ],
            order: { createdAt: 'ASC' },
            relations: ['owner', 'memberships', 'memberships.user'],
        });
    }

    async findAllByUser(user: User): Promise<Pet[]> {
        const petsByMembership = await this.petsRepository.find({
            where: { memberships: { user: { id: user.id } } },
            relations: ['owner', 'memberships', 'memberships.user'],
            order: { createdAt: 'ASC' },
        });

        const petsByLegacyOwner = await this.petsRepository.find({
            where: { owner: { id: user.id } },
            relations: ['owner', 'memberships', 'memberships.user'],
            order: { createdAt: 'ASC' },
        });

        const byId = new Map<string, Pet>();
        for (const pet of [...petsByMembership, ...petsByLegacyOwner]) {
            byId.set(pet.id, pet);
        }

        return [...byId.values()].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
    }

    async findByIdForUser(user: User, petId: string): Promise<Pet | null> {
        const pet = await this.petsRepository.findOne({
            where: { id: petId },
            relations: ['owner', 'memberships', 'memberships.user'],
        });

        if (!pet) {
            return null;
        }

        const role = await this.getUserRoleForPet(user, pet);
        return role ? pet : null;
    }

    async findById(petId: string): Promise<Pet | null> {
        return this.petsRepository.findOne({
            where: { id: petId },
            relations: ['owner', 'memberships', 'memberships.user'],
        });
    }

    async listMembers(pet: Pet): Promise<PetMemberView[]> {
        const petWithRelations = await this.petsRepository.findOne({
            where: { id: pet.id },
            relations: ['owner', 'memberships', 'memberships.user'],
        });

        if (!petWithRelations) {
            return [];
        }

        const members = petWithRelations.memberships.map((membership) => ({
            id: membership.id,
            role: membership.role,
            tag: membership.tag,
            user: {
                id: membership.user.id,
                telegramId: membership.user.telegramId,
                username: membership.user.username,
                firstName: membership.user.firstName,
                lastName: membership.user.lastName,
            },
        }));

        // Ensure legacy owner is represented even if no explicit membership row exists yet.
        const owner = petWithRelations.owner;
        if (owner && !members.some((m) => m.user.id === owner.id)) {
            members.unshift({
                id: `legacy-owner-${owner.id}`,
                role: PetMemberRole.OWNER,
                tag: 'legacy',
                user: {
                    id: owner.id,
                    telegramId: owner.telegramId,
                    username: owner.username,
                    firstName: owner.firstName,
                    lastName: owner.lastName,
                },
            });
        }

        return members;
    }

    async removeMember(pet: Pet, userId: string): Promise<boolean> {
        const membership = await this.petMembersRepository.findOne({
            where: {
                pet: { id: pet.id },
                user: { id: userId },
            },
            relations: ['pet', 'user'],
        });

        if (!membership) {
            return false;
        }

        if (membership.role === PetMemberRole.OWNER) {
            return false;
        }

        await this.petMembersRepository.remove(membership);
        return true;
    }

    async getUserRoleForPet(user: User, pet: Pet): Promise<PetMemberRole | null> {
        const membership = await this.petMembersRepository.findOne({
            where: {
                pet: { id: pet.id },
                user: { id: user.id },
            },
        });

        if (membership) {
            return membership.role;
        }

        if (pet.owner?.id === user.id) {
            return PetMemberRole.OWNER;
        }

        return null;
    }

    async createInvite(input: {
        pet: Pet;
        role: PetMemberRole;
        tag: string | null;
        expiresAt: number | null;
    }): Promise<PetInvite> {
        const invite = this.petInvitesRepository.create({
            pet: input.pet,
            role: input.role,
            tag: input.tag,
            expiresAt: input.expiresAt,
        });
        return this.petInvitesRepository.save(invite);
    }

    async findInviteById(id: string): Promise<PetInvite | null> {
        return this.petInvitesRepository.findOne({
            where: { id },
            relations: ['pet', 'pet.owner', 'pet.memberships', 'pet.memberships.user'],
        });
    }

    // ─── Avatar ───

    async setAvatar(pet: Pet, data: Buffer, mime: string): Promise<void> {
        await this.petsRepository
            .createQueryBuilder()
            .update(Pet)
            .set({ avatar: data, avatarMime: mime })
            .where('id = :id', { id: pet.id })
            .execute();
    }

    async removeAvatar(pet: Pet): Promise<void> {
        await this.petsRepository
            .createQueryBuilder()
            .update(Pet)
            .set({ avatar: null as any, avatarMime: null })
            .where('id = :id', { id: pet.id })
            .execute();
    }

    async getAvatar(petId: string): Promise<{ data: Buffer; mime: string } | null> {
        const pet = await this.petsRepository.findOne({
            where: { id: petId },
            select: ['id', 'avatar', 'avatarMime'],
        });
        if (!pet?.avatar || !pet.avatarMime) return null;
        return { data: pet.avatar, mime: pet.avatarMime };
    }
}
