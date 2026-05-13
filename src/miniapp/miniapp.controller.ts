import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    NotFoundException,
    Post,
    Query,
    Req,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import 'multer';
import { PetEventType, PetEventValue } from '../pet-events/entities/pet-event.entity';
import { PetEventsService } from '../pet-events/pet-events.service';
import { PetsService } from '../pets/pets.service';
import { PetMemberRole } from '../pets/entities/pet-member.entity';
import { UsersService } from '../users/users.service';
import {
    TelegramInitDataGuard,
    TelegramInitUser,
} from './telegram-init-data.guard';

interface AuthedRequest {
    telegramUser: TelegramInitUser;
}

interface CreateEventDto {
    type: PetEventType;
    value: PetEventValue;
}

interface AddPetMemberDto {
    telegramId: string;
    role?: PetMemberRole;
    tag?: string;
}

interface CreatePetDto {
    name: string;
    age?: string | null;
    breed?: string | null;
    weightKg?: number | null;
    note?: string | null;
}

interface CreateInviteDto {
    role?: PetMemberRole;
    tag?: string;
    expiresInHours?: number;
}

interface UpdatePetDto {
    name?: string;
    age?: string | null;
    breed?: string | null;
    weightKg?: number | null;
    note?: string | null;
}

interface UpdateEventDto {
    type?: PetEventType;
    value?: PetEventValue | null;
    createdAt?: string;
}

interface UpdateMemberDto {
    role: PetMemberRole;
    tag?: string | null;
}

@Controller('miniapp')
@UseGuards(TelegramInitDataGuard)
export class MiniappController {
    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
        private readonly petsService: PetsService,
        private readonly petEventsService: PetEventsService,
    ) { }

    private mapEvent(e: { id: string; type: PetEventType; value: PetEventValue | null; createdAt: Date; pet?: { id: string } | null; images?: { id: string }[] }) {
        return {
            id: e.id,
            type: e.type,
            value: e.value,
            createdAt: e.createdAt,
            petId: e.pet?.id ?? null,
            imageIds: (e.images ?? []).map((i) => i.id),
        };
    }

    @Get('me')
    async getMe(@Req() req: AuthedRequest) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );
        return { lang: user?.lang ?? 'uk' };
    }

    @Patch('me/lang')
    async updateMyLang(
        @Req() req: AuthedRequest,
        @Body() body: { lang: string },
    ) {
        const lang = ['ru', 'en', 'uk', 'bg', 'pl', 'de'].includes(body.lang) ? body.lang : 'uk';
        await this.usersService.updateLang(
            String(req.telegramUser.id),
            lang,
        );
        return { lang };
    }

    @Get('events/today')
    async getTodayEvents(@Req() req: AuthedRequest) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            return [];
        }

        const events = await this.petEventsService.getTodayEventsForUser(user);

        return events.map((e) => this.mapEvent(e));
    }

    @Get('pets')
    async getPets(@Req() req: AuthedRequest) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            return [];
        }

        const pets = await this.petsService.findAllByUser(user);

        return Promise.all(
            pets.map(async (pet) => {
                const role = await this.petsService.getUserRoleForPet(user, pet);
                return {
                    id: pet.id,
                    name: pet.name,
                    age: pet.age,
                    breed: pet.breed,
                    weightKg: pet.weightKg,
                    note: pet.note,
                    hasAvatar: !!pet.avatarMime,
                    role,
                    tag:
                        pet.memberships?.find((m) => m.user.id === user.id)?.tag ??
                        (pet.owner?.id === user.id ? 'primary' : null),
                };
            }),
        );
    }

    @Post('pets')
    async createPet(
        @Req() req: AuthedRequest,
        @Body() body: CreatePetDto,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        if (!body.name?.trim()) {
            throw new ForbiddenException('Pet name is required');
        }

        const pet = await this.petsService.createForUser(user, {
            name: body.name.trim(),
            age: body.age?.trim() || null,
            breed: body.breed?.trim() || null,
            weightKg: body.weightKg ?? null,
            note: body.note?.trim() || null,
        });

        return {
            id: pet.id,
            name: pet.name,
            role: PetMemberRole.OWNER,
            tag: 'primary',
        };
    }

    @Get('pets/:petId/events/today')
    async getTodayEventsForPet(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            return [];
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const events = await this.petEventsService.getTodayEventsForUser(user);

        return events
            .filter((e) => e.pet?.id === pet.id)
            .map((e) => this.mapEvent(e));
    }

    @Post('events')
    async createEvent(
        @Req() req: AuthedRequest,
        @Body() body: CreateEventDto,
    ) {
        if (!body.type || !Object.values(PetEventType).includes(body.type)) {
            throw new ForbiddenException('Invalid event type');
        }

        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findFirstByUser(user);

        const event = await this.petEventsService.createEvent({
            owner: user,
            pet,
            type: body.type,
            value: body.value ?? null,
        });

        return this.mapEvent(event);
    }

    @Post('pets/:petId/events')
    async createEventForPet(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Body() body: CreateEventDto,
    ) {
        if (!body.type || !Object.values(PetEventType).includes(body.type)) {
            throw new ForbiddenException('Invalid event type');
        }

        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const event = await this.petEventsService.createEvent({
            owner: user,
            pet,
            type: body.type,
            value: body.value ?? null,
        });

        return this.mapEvent(event);
    }

    @Get('pets/:petId/members')
    async getPetMembers(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            return [];
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        return this.petsService.listMembers(pet);
    }

    @Delete('pets/:petId')
    async deletePet(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const requestorRole = await this.petsService.getUserRoleForPet(user, pet);
        if (requestorRole !== PetMemberRole.OWNER) {
            throw new ForbiddenException('Only OWNER can delete pet');
        }

        return this.petsService.deletePet(pet);
    }

    @Post('pets/:petId/members')
    async addPetMember(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Body() body: AddPetMemberDto,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const requestorRole = await this.petsService.getUserRoleForPet(user, pet);
        if (requestorRole !== PetMemberRole.OWNER) {
            throw new ForbiddenException('Only OWNER can add members');
        }

        if (!body.telegramId?.trim()) {
            throw new ForbiddenException('telegramId is required');
        }

        const targetUser = await this.usersService.findByTelegramId(body.telegramId.trim());
        if (!targetUser) {
            throw new NotFoundException('Target user not found. They must /start the bot first.');
        }

        const role = body.role ?? PetMemberRole.CAREGIVER;
        if (!Object.values(PetMemberRole).includes(role)) {
            throw new ForbiddenException('Invalid member role');
        }

        const membership = await this.petsService.addOrUpdateMember({
            pet,
            user: targetUser,
            role,
            tag: body.tag ?? null,
        });

        return {
            id: membership.id,
            role: membership.role,
            tag: membership.tag,
            telegramId: targetUser.telegramId,
        };
    }

    @Delete('pets/:petId/members/:memberUserId')
    async removePetMember(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Param('memberUserId') memberUserId: string,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const requestorRole = await this.petsService.getUserRoleForPet(user, pet);
        if (requestorRole !== PetMemberRole.OWNER) {
            throw new ForbiddenException('Only OWNER can remove members');
        }

        const removed = await this.petsService.removeMember(pet, memberUserId);
        if (!removed) {
            throw new ForbiddenException('Member cannot be removed');
        }

        return { deleted: true };
    }

    @Post('pets/:petId/invites')
    async createPetInvite(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Body() body: CreateInviteDto,
    ) {
        const user = await this.usersService.findByTelegramId(
            String(req.telegramUser.id),
        );

        if (!user) {
            throw new NotFoundException('User not found. Complete onboarding in the bot first.');
        }

        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) {
            throw new ForbiddenException('No access to this pet');
        }

        const requestorRole = await this.petsService.getUserRoleForPet(user, pet);
        if (requestorRole !== PetMemberRole.OWNER) {
            throw new ForbiddenException('Only OWNER can create invite links');
        }

        const role = body.role ?? PetMemberRole.CAREGIVER;
        if (!Object.values(PetMemberRole).includes(role)) {
            throw new ForbiddenException('Invalid member role');
        }

        let expiresAt: number | null = null;
        if (body.expiresInHours !== undefined && body.expiresInHours !== null) {
            const expiresInHours = Math.max(1, Math.min(24 * 30, body.expiresInHours));
            expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
        }

        const invite = await this.petsService.createInvite({
            pet,
            role,
            tag: body.tag?.trim() || null,
            expiresAt,
        });

        const botUsername = this.configService.get<string>('bot.username')?.trim();
        if (!botUsername) {
            throw new ForbiddenException('BOT_USERNAME is not configured');
        }

        const inviteLink = `https://t.me/${botUsername}?start=join_${invite.id}`;

        return {
            inviteLink,
            expiresAt,
            role,
            tag: body.tag?.trim() || null,
        };
    }

    // ─── EDIT ENDPOINTS ───

    @Patch('pets/:petId')
    async updatePet(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Body() body: UpdatePetDto,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) throw new ForbiddenException('No access to this pet');
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) throw new ForbiddenException('Only OWNER can edit pet');
        const updated = await this.petsService.updatePet(pet, {
            name: body.name?.trim(),
            age: body.age !== undefined ? (body.age?.trim() || null) : undefined,
            breed: body.breed !== undefined ? (body.breed?.trim() || null) : undefined,
            weightKg: body.weightKg,
            note: body.note !== undefined ? (body.note?.trim() || null) : undefined,
        });
        return { id: updated.id, name: updated.name };
    }

    @Patch('events/:eventId')
    async updateEvent(
        @Req() req: AuthedRequest,
        @Param('eventId') eventId: string,
        @Body() body: UpdateEventDto,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const event = await this.petEventsService.findById(eventId);
        if (!event) throw new NotFoundException('Event not found');
        if (event.owner.id !== user.id) throw new ForbiddenException('Only event creator can edit');
        if (body.type && !Object.values(PetEventType).includes(body.type)) throw new ForbiddenException('Invalid type');
        let createdAt: Date | undefined;
        if (body.createdAt) {
            createdAt = new Date(body.createdAt);
            if (Number.isNaN(createdAt.getTime())) throw new ForbiddenException('Invalid date');
        }
        const updated = await this.petEventsService.updateEvent(event, body.value ?? event.value, body.type, createdAt);
        return this.mapEvent(updated);
    }

    @Delete('events/:eventId')
    async deleteEvent(
        @Req() req: AuthedRequest,
        @Param('eventId') eventId: string,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const event = await this.petEventsService.findById(eventId);
        if (!event) throw new NotFoundException('Event not found');
        if (event.owner.id !== user.id) throw new ForbiddenException('Only event creator can delete');
        await this.petEventsService.deleteEvent(event);
        return { deleted: true };
    }

    @Patch('pets/:petId/members/:memberUserId')
    async updateMemberRole(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Param('memberUserId') memberUserId: string,
        @Body() body: UpdateMemberDto,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) throw new ForbiddenException('No access to this pet');
        const requestorRole = await this.petsService.getUserRoleForPet(user, pet);
        if (requestorRole !== PetMemberRole.OWNER) throw new ForbiddenException('Only OWNER can change roles');
        if (!Object.values(PetMemberRole).includes(body.role)) throw new ForbiddenException('Invalid role');
        const membership = await this.petsService.updateMemberRole(pet, memberUserId, body.role, body.tag);
        if (!membership) throw new NotFoundException('Member not found');
        return { id: membership.id, role: membership.role, tag: membership.tag };
    }

    @Get('pets/:petId/events')
    async getEventsInRange(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @Query('from') fromStr: string,
        @Query('to') toStr: string,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) return [];
        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) throw new ForbiddenException('No access to this pet');
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ForbiddenException('Invalid date range');
        const events = await this.petEventsService.getEventsForPetInRange(user, petId, from, to);
        return events.map((e) => this.mapEvent(e));
    }

    // ─── PET AVATAR ───

    @Post('pets/:petId/avatar')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
            else cb(new ForbiddenException('Only jpeg/png/webp/gif allowed'), false);
        },
    }))
    async uploadAvatar(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new ForbiddenException('File is required');
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) throw new ForbiddenException('No access to this pet');
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) throw new ForbiddenException('Only OWNER can set avatar');
        await this.petsService.setAvatar(pet, file.buffer, file.mimetype);
        return { ok: true };
    }

    @Delete('pets/:petId/avatar')
    async deleteAvatar(
        @Req() req: AuthedRequest,
        @Param('petId') petId: string,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const pet = await this.petsService.findByIdForUser(user, petId);
        if (!pet) throw new ForbiddenException('No access to this pet');
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) throw new ForbiddenException('Only OWNER can delete avatar');
        await this.petsService.removeAvatar(pet);
        return { deleted: true };
    }

    // ─── EVENT IMAGES ───

    @Post('events/:eventId/images')
    @UseInterceptors(FilesInterceptor('files', 10, {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
            else cb(new ForbiddenException('Only jpeg/png/webp/gif allowed'), false);
        },
    }))
    async uploadEventImages(
        @Req() req: AuthedRequest,
        @Param('eventId') eventId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files?.length) throw new ForbiddenException('At least one file is required');
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const event = await this.petEventsService.findById(eventId);
        if (!event) throw new NotFoundException('Event not found');
        if (event.owner.id !== user.id) throw new ForbiddenException('Only event creator can add images');
        const existing = await this.petEventsService.countImages(eventId);
        if (existing + files.length > 10) throw new ForbiddenException(`Max 10 images per event (currently ${existing})`);
        const ids: string[] = [];
        for (const f of files) {
            const img = await this.petEventsService.addImage(event, f.buffer, f.mimetype);
            ids.push(img.id);
        }
        return { imageIds: ids };
    }

    @Delete('events/:eventId/images/:imageId')
    async deleteEventImage(
        @Req() req: AuthedRequest,
        @Param('eventId') eventId: string,
        @Param('imageId') imageId: string,
    ) {
        const user = await this.usersService.findByTelegramId(String(req.telegramUser.id));
        if (!user) throw new NotFoundException('User not found');
        const img = await this.petEventsService.findImageById(imageId);
        if (!img) throw new NotFoundException('Image not found');
        if (img.event.id !== eventId) throw new ForbiddenException('Image does not belong to this event');
        if (img.event.owner.id !== user.id) throw new ForbiddenException('Only event creator can delete images');
        await this.petEventsService.deleteImage(img);
        return { deleted: true };
    }
}
