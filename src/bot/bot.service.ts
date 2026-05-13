import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InputFile, Keyboard } from 'grammy';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { PetMemberRole } from '../pets/entities/pet-member.entity';
import { PetEventsService } from '../pet-events/pet-events.service';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { PetEvent, PetEventType, WalkEventValue, FoodEventValue, WeightEventValue, NoteEventValue } from '../pet-events/entities/pet-event.entity';
import {
    OnboardingSession,
    OnboardingStep,
    PendingEventSession,
    WalkLogSession,
    WalkLogStep,
    EditPetSession,
    EditPetStep,
    EditEventSession,
} from './bot.types';
import {
    CANCEL_KEYWORD,
    MENU_CALLBACKS,
    REPLY_BUTTONS,
    SKIP_KEYWORD,
} from './bot.constants';

type BotContext = Context;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BotService.name);
    private bot: Bot<BotContext> | null = null;

    private readonly onboardingSessions = new Map<string, OnboardingSession>();
    private readonly pendingEventSessions = new Map<string, PendingEventSession>();
    private readonly walkLogSessions = new Map<string, WalkLogSession>();
    private readonly awaitingAddPetDecision = new Map<string, true>();
    private readonly pendingInviteTokens = new Map<string, string>();
    private readonly editPetSessions = new Map<string, EditPetSession>();
    private readonly editEventSessions = new Map<string, EditEventSession>();
    private readonly awaitingPetAvatar = new Map<string, string>(); // telegramId → petId

    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
        private readonly petsService: PetsService,
        private readonly petEventsService: PetEventsService,
    ) { }

    async onModuleInit(): Promise<void> {
        const botToken = this.configService.get<string>('bot.token');

        if (!botToken) {
            this.logger.warn('BOT_TOKEN is not set. Telegram bot is not started.');
            return;
        }

        this.bot = new Bot<BotContext>(botToken);

        this.registerHandlers();

        // Drop any active webhook / previous long-poll session before starting
        await this.bot.api.deleteWebhook({ drop_pending_updates: true });

        // Start polling in background (do NOT await — it's a long-running loop)
        this.bot.start().catch((err: unknown) => {
            this.logger.error('Telegram bot crashed:', err);
        });
        this.logger.log('Telegram bot started');
    }

    onModuleDestroy(): void {
        if (!this.bot) {
            return;
        }

        this.bot.stop();
        this.logger.log('Telegram bot stopped');
    }

    private registerHandlers(): void {
        if (!this.bot) {
            return;
        }

        this.bot.command('start', async (ctx) => {
            await this.handleStartCommand(ctx);
        });

        this.bot.command('restart_onboarding', async (ctx) => {
            await this.handleRestartOnboardingCommand(ctx);
        });

        this.bot.command('add_pet', async (ctx) => {
            await this.handleAddPetCommand(ctx);
        });

        this.bot.command('share_pet', async (ctx) => {
            await this.handleSharePetCommand(ctx);
        });

        this.bot.command('edit_pet', async (ctx) => {
            await this.handleEditPetCommand(ctx);
        });

        this.bot.command('set_avatar', async (ctx) => {
            await this.handleSetAvatarCommand(ctx);
        });

        this.bot.on('message:contact', async (ctx) => {
            await this.handleContactMessage(ctx);
        });

        this.bot.on('message:photo', async (ctx) => {
            await this.handlePhotoMessage(ctx);
        });

        this.bot.on('message:text', async (ctx) => {
            await this.handleTextMessage(ctx);
        });

        this.bot.on('callback_query:data', async (ctx) => {
            await this.handleCallbackQuery(ctx);
        });

        this.bot.catch((error) => {
            this.logger.error('Bot error', error.error);
        });
    }

    private async handleStartCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply('Не удалось определить пользователя Telegram.');
            return;
        }

        const startPayload = this.getStartPayload(ctx);
        if (startPayload?.startsWith('join_')) {
            await this.handleInviteJoin(ctx, telegramId, startPayload.slice(5));
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        const pet = user ? await this.petsService.findFirstByUser(user) : null;

        if (user) {
            this.awaitingAddPetDecision.delete(telegramId);
            this.onboardingSessions.delete(telegramId);
            this.pendingEventSessions.delete(telegramId);

            if (pet) {
                await ctx.reply(
                    `👋 С возвращением, ${this.getDisplayName(user)}!\nАктивный питомец: ${pet.name}`,
                );
                await this.sendMainMenu(ctx);
                return;
            }

            await ctx.reply(
                '✅ Аккаунт готов!\n\nДоступ к питомцу пока не найден.\n• Если пришли по приглашению — откройте invite-ссылку\n• Или добавьте своего: /add_pet',
            );
            await this.sendMainMenu(ctx);
            return;
        }

        this.awaitingAddPetDecision.set(telegramId, true);
        await ctx.reply(
            'Привет! Хотите добавить питомца сейчас? Ответьте "да" или "нет".\n\n' +
            'Если ответите "нет", просто открою меню без онбординга.',
        );
    }

    private async handleAddPetCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply('Не удалось определить пользователя Telegram.');
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
            await this.startOnboarding(
                ctx,
                'Чтобы добавить питомца, сначала поделитесь контактом.',
            );
            return;
        }

        this.onboardingSessions.set(telegramId, {
            step: OnboardingStep.WAITING_PET_NAME,
            data: {},
        });

        await ctx.reply('Как зовут вашего питомца?');
    }

    private async handleInviteJoin(
        ctx: BotContext,
        telegramId: string,
        inviteId: string,
    ): Promise<void> {
        const user =
            (await this.usersService.findByTelegramId(telegramId)) ??
            (await this.usersService.createOrUpdateFromTelegramContact({
                telegramId,
                username: ctx.from?.username,
                firstName: ctx.from?.first_name,
                lastName: ctx.from?.last_name,
            }));

        const invite = await this.petsService.findInviteById(inviteId);
        if (!invite) {
            await ctx.reply('Ссылка-приглашение недействительна или просрочена.');
            return;
        }

        if (invite.expiresAt && Date.now() > Number(invite.expiresAt)) {
            await ctx.reply('Ссылка-приглашение просрочена.');
            return;
        }

        const pet = invite.pet;
        if (!pet) {
            await ctx.reply('Питомец не найден. Возможно, приглашение устарело.');
            return;
        }

        // Don't downgrade existing role (e.g. OWNER clicking own invite link)
        const existingRole = await this.petsService.getUserRoleForPet(user, pet);
        if (existingRole) {
            const roleHierarchy: Record<string, number> = { OWNER: 5, VET: 4, TRAINER: 3, CAREGIVER: 2, OBSERVER: 1 };
            const existingLevel = roleHierarchy[existingRole] ?? 0;
            const inviteLevel = roleHierarchy[invite.role] ?? 0;
            if (existingLevel >= inviteLevel) {
                await ctx.reply(
                    `Вы уже имеете доступ к ${pet.name} с ролью ${existingRole}. Понижение не произведено.`,
                );
                await this.sendMainMenu(ctx);
                return;
            }
        }

        await this.petsService.addOrUpdateMember({
            pet,
            user,
            role: invite.role,
            tag: invite.tag,
        });

        this.awaitingAddPetDecision.delete(telegramId);
        this.pendingInviteTokens.delete(telegramId);
        this.onboardingSessions.delete(telegramId);

        await ctx.reply(
            `Готово! Вам выдан доступ к питомцу ${pet.name} (роль: ${invite.role}).`,
        );
        await this.sendMainMenu(ctx);
    }

    private async handleRestartOnboardingCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply('Не удалось определить пользователя Telegram.');
            return;
        }

        this.onboardingSessions.delete(telegramId);
        this.pendingEventSessions.delete(telegramId);
        this.walkLogSessions.delete(telegramId);
        this.awaitingAddPetDecision.delete(telegramId);
        this.pendingInviteTokens.delete(telegramId);

        await this.startOnboarding(
            ctx,
            'Начинаем onboarding заново. Поделитесь, пожалуйста, вашим контактом.',
        );
    }

    private async handleSharePetCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.message || !('text' in ctx.message)) {
            return;
        }

        const commandText = ctx.message.text;
        if (!commandText) {
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
            await ctx.reply('Сначала выполните /start и завершите onboarding.');
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) {
            await ctx.reply('У вас пока нет доступных питомцев.');
            return;
        }

        const currentRole = await this.petsService.getUserRoleForPet(user, pet);
        if (currentRole !== PetMemberRole.OWNER) {
            await ctx.reply('Добавлять участников может только роль OWNER.');
            return;
        }

        const [_, targetTelegramIdRaw, roleRaw, ...tagParts] = commandText.trim().split(/\s+/);

        if (!targetTelegramIdRaw) {
            await ctx.reply(
                'Использование: /share_pet <telegram_id> [owner|caregiver|observer|trainer|vet] [tag]',
            );
            return;
        }

        const targetUser = await this.usersService.findByTelegramId(targetTelegramIdRaw);
        if (!targetUser) {
            await ctx.reply('Пользователь не найден. Пусть сначала откроет бота и выполнит /start.');
            return;
        }

        const parsedRole = this.parseMemberRole(roleRaw);
        if (!parsedRole) {
            await ctx.reply('Неизвестная роль. Доступно: owner, caregiver, observer, trainer, vet.');
            return;
        }

        await this.petsService.addOrUpdateMember({
            pet,
            user: targetUser,
            role: parsedRole,
            tag: tagParts.length > 0 ? tagParts.join(' ') : null,
        });

        await ctx.reply(
            `Доступ к питомцу ${pet.name} выдан пользователю ${targetTelegramIdRaw} с ролью ${parsedRole}.`,
        );
    }

    private async handleContactMessage(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.message || !('contact' in ctx.message)) {
            return;
        }

        const contact = ctx.message.contact;
        if (!contact) {
            return;
        }

        const session = this.onboardingSessions.get(telegramId);
        if (!session || session.step !== OnboardingStep.WAITING_CONTACT) {
            return;
        }

        if (contact.user_id && String(contact.user_id) !== telegramId) {
            await ctx.reply(
                'Пожалуйста, отправьте свой контакт кнопкой «Поделиться контактом».',
            );
            return;
        }

        const user = await this.usersService.createOrUpdateFromTelegramContact({
            telegramId,
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
            phoneNumber: contact.phone_number,
        });

        const pendingInviteToken = this.pendingInviteTokens.get(telegramId);
        if (pendingInviteToken) {
            const invite = await this.petsService.findInviteById(pendingInviteToken);
            this.pendingInviteTokens.delete(telegramId);

            if (!invite || (invite.expiresAt && Date.now() > Number(invite.expiresAt))) {
                await ctx.reply(
                    'Ссылка-приглашение недействительна или просрочена. Можно продолжить обычный onboarding.',
                    { reply_markup: { remove_keyboard: true } },
                );
            } else {
                const pet = invite.pet;
                if (!pet) {
                    await ctx.reply(
                        'Питомец из приглашения не найден. Можно продолжить обычный onboarding.',
                        { reply_markup: { remove_keyboard: true } },
                    );
                } else {
                    await this.petsService.addOrUpdateMember({
                        pet,
                        user,
                        role: invite.role,
                        tag: invite.tag,
                    });

                    this.onboardingSessions.delete(telegramId);
                    await ctx.reply(
                        `Готово! Вы подключены к питомцу ${pet.name} (роль: ${invite.role}).`,
                        { reply_markup: { remove_keyboard: true } },
                    );
                    await this.sendMainMenu(ctx);
                    return;
                }
            }
        }

        this.onboardingSessions.set(telegramId, {
            ...session,
            step: OnboardingStep.WAITING_PET_NAME,
        });

        await ctx.reply('Контакт сохранен. Как зовут вашего питомца?', {
            reply_markup: { remove_keyboard: true },
        });
    }

    private parseMemberRole(raw: string | undefined): PetMemberRole | null {
        if (!raw) {
            return PetMemberRole.CAREGIVER;
        }

        const normalized = raw.trim().toLowerCase();

        switch (normalized) {
            case 'owner':
            case 'хозяин':
                return PetMemberRole.OWNER;
            case 'caregiver':
            case 'куратор':
                return PetMemberRole.CAREGIVER;
            case 'observer':
            case 'наблюдатель':
                return PetMemberRole.OBSERVER;
            case 'trainer':
            case 'кинолог':
                return PetMemberRole.TRAINER;
            case 'vet':
            case 'врач':
            case 'вет':
                return PetMemberRole.VET;
            default:
                return null;
        }
    }

    private async handleTextMessage(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.message || !('text' in ctx.message)) {
            return;
        }

        const textMessage = ctx.message.text;
        if (!textMessage) {
            return;
        }

        const text = textMessage.trim();

        if (text.startsWith('/')) {
            return;
        }

        // Handle reply keyboard buttons
        const replyButtonAction = await this.handleReplyButton(ctx, telegramId, text);
        if (replyButtonAction) return;

        // Cancel pet avatar if pending
        if (this.awaitingPetAvatar.has(telegramId) && text.toLowerCase() === CANCEL_KEYWORD) {
            this.awaitingPetAvatar.delete(telegramId);
            await ctx.reply('Установка аватара отменена.');
            await this.sendMainMenu(ctx);
            return;
        }

        if (this.awaitingAddPetDecision.get(telegramId)) {
            const normalized = text.toLowerCase();

            if (['да', 'д', 'yes', 'y'].includes(normalized)) {
                this.awaitingAddPetDecision.delete(telegramId);
                await this.startOnboarding(
                    ctx,
                    'Отлично. Для начала поделитесь контактом.',
                );
                return;
            }

            if (['нет', 'н', 'no', 'n'].includes(normalized)) {
                this.awaitingAddPetDecision.delete(telegramId);

                await this.usersService.createOrUpdateFromTelegramContact({
                    telegramId,
                    username: ctx.from?.username,
                    firstName: ctx.from?.first_name,
                    lastName: ctx.from?.last_name,
                });

                await ctx.reply(
                    'Ок, без добавления питомца. Меню доступно, а онбординг можно запустить позже через /add_pet.',
                );
                await this.sendMainMenu(ctx);
                return;
            }

            await ctx.reply('Ответьте "да" или "нет".');
            return;
        }

        const pendingEvent = this.pendingEventSessions.get(telegramId);
        if (pendingEvent) {
            await this.handlePendingEventInput(ctx, telegramId, text, pendingEvent);
            return;
        }

        const walkSession = this.walkLogSessions.get(telegramId);
        if (walkSession) {
            await this.handleWalkLogInput(ctx, telegramId, text, walkSession);
            return;
        }

        const editPetSession = this.editPetSessions.get(telegramId);
        if (editPetSession) {
            await this.handleEditPetInput(ctx, telegramId, text, editPetSession);
            return;
        }

        const editEventSession = this.editEventSessions.get(telegramId);
        if (editEventSession) {
            await this.handleEditEventInput(ctx, telegramId, text, editEventSession);
            return;
        }

        const onboarding = this.onboardingSessions.get(telegramId);
        if (!onboarding) {
            await ctx.reply(
                'Я не понял сообщение. Используйте /start, чтобы открыть главное меню.',
            );
            return;
        }

        await this.handleOnboardingStep(ctx, telegramId, text, onboarding);
    }

    private async handleEditPetCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) return;
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) { await ctx.reply('Сначала /start'); return; }
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply('Нет питомцев. /add_pet'); return; }
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) { await ctx.reply('Только владелец может редактировать.'); return; }
        this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId: pet.id });
        await ctx.reply(
            `Редактирование ${pet.name}. Что изменить?\n1️⃣ Имя\n2️⃣ Возраст\n3️⃣ Породу\n4️⃣ Вес\n5️⃣ Заметку\n\nВведите номер или «${CANCEL_KEYWORD}».`,
        );
    }

    private async handleEditPetInput(ctx: BotContext, telegramId: string, text: string, session: EditPetSession): Promise<void> {
        if (text.toLowerCase() === CANCEL_KEYWORD) {
            this.editPetSessions.delete(telegramId);
            await ctx.reply('Редактирование отменено.');
            await this.sendMainMenu(ctx);
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) { this.editPetSessions.delete(telegramId); return; }
        const pet = await this.petsService.findById(session.petId);
        if (!pet) { this.editPetSessions.delete(telegramId); await ctx.reply('Питомец не найден.'); return; }

        if (session.step === EditPetStep.WAITING_FIELD_CHOICE) {
            const fields: Record<string, 'name' | 'age' | 'breed' | 'weightKg' | 'note'> = { '1': 'name', '2': 'age', '3': 'breed', '4': 'weightKg', '5': 'note' };
            const field = fields[text.trim()];
            if (!field) { await ctx.reply('Введите число от 1 до 5.'); return; }
            this.editPetSessions.set(telegramId, { ...session, step: EditPetStep.WAITING_NEW_VALUE, field });
            const labels: Record<string, string> = { name: 'имя', age: 'возраст', breed: 'породу', weightKg: 'вес (кг)', note: 'заметку' };
            await ctx.reply(`Введите новое значение для «${labels[field]}» или «${CANCEL_KEYWORD}»:`);
            return;
        }

        if (session.step === EditPetStep.WAITING_NEW_VALUE && session.field) {
            const payload: Record<string, unknown> = {};
            if (session.field === 'weightKg') {
                const w = this.parseWeight(text);
                if (w === null) { await ctx.reply('Некорректный вес. Попробуйте еще раз.'); return; }
                payload.weightKg = w;
            } else {
                payload[session.field] = text.trim();
            }
            await this.petsService.updatePet(pet, payload);
            this.editPetSessions.delete(telegramId);
            await ctx.reply(`✅ ${pet.name} обновлен.`);
            await this.sendMainMenu(ctx);
        }
    }

    private async handleEditEventInput(ctx: BotContext, telegramId: string, text: string, session: EditEventSession): Promise<void> {
        if (text.toLowerCase() === CANCEL_KEYWORD) {
            this.editEventSessions.delete(telegramId);
            await ctx.reply('Редактирование отменено.');
            await this.sendMainMenu(ctx);
            return;
        }
        const event = await this.petEventsService.findById(session.eventId);
        if (!event) { this.editEventSessions.delete(telegramId); await ctx.reply('Событие не найдено.'); return; }

        // For bot editing, update the text/note field based on type
        let newValue = event.value;
        switch (event.type) {
            case PetEventType.NOTE:
                newValue = { text: text.trim() } as NoteEventValue;
                break;
            case PetEventType.WEIGHT: {
                const kg = this.parseWeight(text);
                if (kg === null) { await ctx.reply('Некорректный вес.'); return; }
                newValue = { kg } as WeightEventValue;
                break;
            }
            default:
                // For walk/food, update the note field within the existing JSON
                if (newValue && typeof newValue === 'object') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (newValue as any).note = text.trim();
                }
        }

        await this.petEventsService.updateEvent(event, newValue);
        this.editEventSessions.delete(telegramId);
        await ctx.reply('✅ Событие обновлено.');
        await this.sendMainMenu(ctx);
    }

    private async handleOnboardingStep(
        ctx: BotContext,
        telegramId: string,
        text: string,
        session: OnboardingSession,
    ): Promise<void> {
        switch (session.step) {
            case OnboardingStep.WAITING_CONTACT: {
                await ctx.reply(
                    'Сначала нажмите кнопку «Поделиться контактом», чтобы продолжить.',
                );
                return;
            }

            case OnboardingStep.WAITING_PET_NAME: {
                if (!text || text.toLowerCase() === SKIP_KEYWORD) {
                    await ctx.reply('Имя питомца обязательно. Введите имя.');
                    return;
                }

                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_AGE,
                    data: {
                        ...session.data,
                        name: text,
                    },
                });

                await ctx.reply(
                    `Сколько лет питомцу? Если не знаете, напишите «${SKIP_KEYWORD}».`,
                );
                return;
            }

            case OnboardingStep.WAITING_PET_AGE: {
                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_BREED,
                    data: {
                        ...session.data,
                        age: this.normalizeOptionalText(text),
                    },
                });

                await ctx.reply(
                    `Какая порода? Если не хотите указывать, напишите «${SKIP_KEYWORD}».`,
                );
                return;
            }

            case OnboardingStep.WAITING_PET_BREED: {
                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_WEIGHT,
                    data: {
                        ...session.data,
                        breed: this.normalizeOptionalText(text),
                    },
                });

                await ctx.reply(
                    `Укажите вес в кг (например, 12.5). Если не знаете, напишите «${SKIP_KEYWORD}».`,
                );
                return;
            }

            case OnboardingStep.WAITING_PET_WEIGHT: {
                const normalized = text.toLowerCase();
                let weightKg: number | null = null;

                if (normalized !== SKIP_KEYWORD) {
                    const parsedWeight = this.parseWeight(text);
                    if (parsedWeight === null) {
                        await ctx.reply(
                            `Не удалось распознать вес. Введите число (например, 12.5) или «${SKIP_KEYWORD}».`,
                        );
                        return;
                    }
                    weightKg = parsedWeight;
                }

                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_NOTE,
                    data: {
                        ...session.data,
                        weightKg,
                    },
                });

                await ctx.reply(
                    `Добавьте заметку о питомце, если хотите. Для пропуска напишите «${SKIP_KEYWORD}».`,
                );
                return;
            }

            case OnboardingStep.WAITING_PET_NOTE: {
                const user = await this.usersService.findByTelegramId(telegramId);
                if (!user) {
                    await this.startOnboarding(
                        ctx,
                        'Не удалось найти пользователя. Начнем заново, отправьте контакт.',
                    );
                    return;
                }

                const finalPetData = {
                    ...session.data,
                    note: this.normalizeOptionalText(text),
                };

                if (!finalPetData.name) {
                    await this.startOnboarding(
                        ctx,
                        'Не удалось сохранить имя питомца. Начнем onboarding заново.',
                    );
                    return;
                }

                const pet = await this.petsService.createForUser(user, {
                    name: finalPetData.name,
                    age: finalPetData.age ?? null,
                    breed: finalPetData.breed ?? null,
                    weightKg: finalPetData.weightKg ?? null,
                    note: finalPetData.note ?? null,
                });

                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.COMPLETED,
                    data: finalPetData,
                });

                await ctx.reply(this.buildOnboardingSummary(pet));

                this.onboardingSessions.delete(telegramId);
                await this.sendMainMenu(ctx);
                return;
            }

            case OnboardingStep.COMPLETED: {
                this.onboardingSessions.delete(telegramId);
                await this.sendMainMenu(ctx);
                return;
            }

            default: {
                await ctx.reply('Произошла ошибка шага onboarding. Используйте /restart_onboarding.');
            }
        }
    }

    private async handlePendingEventInput(
        ctx: BotContext,
        telegramId: string,
        text: string,
        pendingEvent: PendingEventSession,
    ): Promise<void> {
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply('Сначала выполните /start, чтобы зарегистрироваться.');
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(
                'У вас нет питомцев. Добавьте питомца через /add_pet или примите приглашение.',
            );
            return;
        }

        if (text.toLowerCase() === CANCEL_KEYWORD) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply('Действие отменено.');
            await this.sendMainMenu(ctx);
            return;
        }

        if (pendingEvent.type === PetEventType.WEIGHT) {
            const weight = this.parseWeight(text);
            if (weight === null) {
                await ctx.reply(
                    `Некорректный вес. Введите число (например, 12.5) или «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            await this.petEventsService.createEvent({
                owner: user,
                pet,
                type: PetEventType.WEIGHT,
                value: { kg: weight } as WeightEventValue,
            });

            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(`Вес ${weight.toFixed(2)} кг сохранен.`);
            await this.sendMainMenu(ctx);
            return;
        }

        if (pendingEvent.type === PetEventType.NOTE) {
            if (!text) {
                await ctx.reply(
                    `Заметка не может быть пустой. Введите текст или «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            await this.petEventsService.createEvent({
                owner: user,
                pet,
                type: PetEventType.NOTE,
                value: { text } as NoteEventValue,
            });

            this.pendingEventSessions.delete(telegramId);
            await ctx.reply('Заметка сохранена.');
            await this.sendMainMenu(ctx);
        }
    }

    private async handleWalkLogInput(
        ctx: BotContext,
        telegramId: string,
        text: string,
        walkSession: WalkLogSession,
    ): Promise<void> {
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply('Сначала выполните /start, чтобы зарегистрироваться.');
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply(
                'У вас нет питомцев. Добавьте питомца через /add_pet или примите приглашение.',
            );
            return;
        }

        const normalized = text.toLowerCase();

        if (normalized === CANCEL_KEYWORD) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply('Запись прогулки отменена.');
            await this.sendMainMenu(ctx);
            return;
        }

        switch (walkSession.step) {
            case WalkLogStep.WAITING_DURATION_MINUTES: {
                const durationMinutes = this.parseDurationMinutes(text);
                if (durationMinutes === null) {
                    await ctx.reply(
                        `Не удалось распознать длительность. Введите число минут, например 35. Для отмены: «${CANCEL_KEYWORD}».`,
                    );
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_END_TIME,
                    data: {
                        ...walkSession.data,
                        durationMinutes,
                    },
                });

                await ctx.reply(
                    `Когда вернулись с прогулки? Напишите время в формате ЧЧ:ММ или «сейчас». Для отмены: «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            case WalkLogStep.WAITING_END_TIME: {
                const endTime = this.normalizeTime(text);
                if (!endTime) {
                    await ctx.reply(
                        `Укажите время окончания в формате ЧЧ:ММ или напишите «сейчас». Для отмены: «${CANCEL_KEYWORD}».`,
                    );
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_POOP,
                    data: {
                        ...walkSession.data,
                        endTime,
                    },
                });

                await ctx.reply('Какал ли на прогулке? Ответьте «да» или «нет».');
                return;
            }

            case WalkLogStep.WAITING_POOP: {
                const pooped = this.parseYesNo(text);
                if (pooped === null) {
                    await ctx.reply(
                        `Не понял ответ. Напишите «да» или «нет». Для отмены: «${CANCEL_KEYWORD}».`,
                    );
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_PEE,
                    data: {
                        ...walkSession.data,
                        pooped,
                    },
                });

                await ctx.reply('Писал ли на прогулке? Ответьте «да» или «нет».');
                return;
            }

            case WalkLogStep.WAITING_PEE: {
                const peed = this.parseYesNo(text);
                if (peed === null) {
                    await ctx.reply(
                        `Не понял ответ. Напишите «да» или «нет». Для отмены: «${CANCEL_KEYWORD}».`,
                    );
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_NOTE,
                    data: {
                        ...walkSession.data,
                        peed,
                    },
                });

                await ctx.reply(
                    `Доп. заметка по прогулке (например, настроение, активность). Или «${SKIP_KEYWORD}».`,
                );
                return;
            }

            case WalkLogStep.WAITING_NOTE: {
                const finalData = {
                    ...walkSession.data,
                    note: this.normalizeOptionalText(text),
                };

                if (
                    !finalData.endTime ||
                    finalData.durationMinutes === undefined ||
                    finalData.pooped === undefined ||
                    finalData.peed === undefined
                ) {
                    this.walkLogSessions.delete(telegramId);
                    await ctx.reply('Не удалось сохранить прогулку. Попробуйте еще раз.');
                    await this.sendMainMenu(ctx);
                    return;
                }

                const startTime = this.computeStartTime(finalData.endTime, finalData.durationMinutes);

                const walkValue: WalkEventValue = {
                    startTime,
                    endTime: finalData.endTime,
                    durationMinutes: finalData.durationMinutes,
                    pooped: finalData.pooped,
                    peed: finalData.peed,
                    note: finalData.note,
                };

                await this.petEventsService.createEvent({
                    owner: user,
                    pet,
                    type: PetEventType.WALK,
                    value: walkValue,
                });

                this.walkLogSessions.delete(telegramId);
                await ctx.reply(
                    [
                        'Прогулка сохранена.',
                        'Резюме:',
                        `${startTime} → ${finalData.endTime} (${finalData.durationMinutes} мин)`,
                        `Какал: ${finalData.pooped ? 'да' : 'нет'}`,
                        `Писал: ${finalData.peed ? 'да' : 'нет'}`,
                    ].join('\n'),
                );
                await this.sendMainMenu(ctx);
                return;
            }

            default: {
                this.walkLogSessions.delete(telegramId);
                await ctx.reply('Ошибка шага прогулки. Попробуйте начать снова.');
                await this.sendMainMenu(ctx);
            }
        }
    }

    private async handleCallbackQuery(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.callbackQuery) {
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
            await ctx.answerCallbackQuery({ text: 'Сначала выполните /start.' });
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            await ctx.answerCallbackQuery();
            await ctx.reply(
                'У вас нет питомцев. Добавьте питомца через /add_pet или примите приглашение.',
            );
            return;
        }

        switch (ctx.callbackQuery.data) {
            case MENU_CALLBACKS.WALK: {
                this.pendingEventSessions.delete(telegramId);
                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_DURATION_MINUTES,
                    data: {},
                });

                await ctx.answerCallbackQuery({ text: 'Начинаем запись прогулки' });
                await ctx.reply(
                    `Сколько примерно гуляли (в минутах)? Для отмены: «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            case MENU_CALLBACKS.FOOD: {
                await this.petEventsService.createEvent({
                    owner: user,
                    pet,
                    type: PetEventType.FOOD,
                    value: { foodType: 'Быстрая отметка', amount: '', appetite: 'good', note: null } as FoodEventValue,
                });
                await ctx.answerCallbackQuery({ text: 'Кормление записано' });
                await ctx.reply('Готово, кормление записано.');
                return;
            }

            case MENU_CALLBACKS.WEIGHT: {
                this.pendingEventSessions.set(telegramId, { type: PetEventType.WEIGHT });
                await ctx.answerCallbackQuery();
                await ctx.reply(
                    `Введите текущий вес в кг (например, 12.5) или «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            case MENU_CALLBACKS.NOTE: {
                this.pendingEventSessions.set(telegramId, { type: PetEventType.NOTE });
                await ctx.answerCallbackQuery();
                await ctx.reply(`Введите текст заметки или «${CANCEL_KEYWORD}».`);
                return;
            }

            case MENU_CALLBACKS.STATS_TODAY: {
                const events = await this.petEventsService.getTodayEventsForUser(user);
                await ctx.answerCallbackQuery();
                await ctx.reply(this.buildTodayStats(events));
                return;
            }

            case MENU_CALLBACKS.EDIT_PET: {
                const role = await this.petsService.getUserRoleForPet(user, pet);
                if (role !== PetMemberRole.OWNER) {
                    await ctx.answerCallbackQuery({ text: 'Только владелец' });
                    return;
                }
                this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId: pet.id });
                await ctx.answerCallbackQuery();
                await ctx.reply(
                    `Редактирование ${pet.name}. Что изменить?\n1️⃣ Имя\n2️⃣ Возраст\n3️⃣ Породу\n4️⃣ Вес\n5️⃣ Заметку\n\nВведите номер или «${CANCEL_KEYWORD}».`,
                );
                return;
            }

            case MENU_CALLBACKS.DELETE_LAST_EVENT: {
                const todayEvents = await this.petEventsService.getTodayEventsForUser(user);
                const lastEvent = todayEvents.at(-1);
                if (!lastEvent) {
                    await ctx.answerCallbackQuery({ text: 'Нет событий за сегодня' });
                    return;
                }
                await this.petEventsService.deleteEvent(lastEvent);
                await ctx.answerCallbackQuery({ text: 'Последнее событие удалено' });
                await ctx.reply(`🗑 Удалено: ${lastEvent.type}`);
                return;
            }

            default: {
                // Handle dynamic callbacks like edit_pet_<uuid>, avatar_pet_<uuid>
                const cbData = ctx.callbackQuery.data ?? '';

                if (cbData.startsWith('edit_pet_')) {
                    const petId = cbData.slice('edit_pet_'.length);
                    const targetPet = await this.petsService.findById(petId);
                    if (!targetPet) {
                        await ctx.answerCallbackQuery({ text: 'Питомец не найден' });
                        return;
                    }
                    const role = await this.petsService.getUserRoleForPet(user, targetPet);
                    if (role !== PetMemberRole.OWNER) {
                        await ctx.answerCallbackQuery({ text: 'Только владелец' });
                        return;
                    }
                    this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId });
                    await ctx.answerCallbackQuery();
                    await ctx.reply(
                        `Редактирование ${targetPet.name}. Что изменить?\n1️⃣ Имя\n2️⃣ Возраст\n3️⃣ Породу\n4️⃣ Вес\n5️⃣ Заметку\n\nВведите номер или «${CANCEL_KEYWORD}».`,
                    );
                    return;
                }

                if (cbData.startsWith('avatar_pet_')) {
                    const petId = cbData.slice('avatar_pet_'.length);
                    const targetPet = await this.petsService.findById(petId);
                    if (!targetPet) {
                        await ctx.answerCallbackQuery({ text: 'Питомец не найден' });
                        return;
                    }
                    const role = await this.petsService.getUserRoleForPet(user, targetPet);
                    if (role !== PetMemberRole.OWNER) {
                        await ctx.answerCallbackQuery({ text: 'Только владелец' });
                        return;
                    }
                    this.awaitingPetAvatar.set(telegramId, petId);
                    await ctx.answerCallbackQuery();
                    await ctx.reply(`Отправьте фото для аватара ${targetPet.name} или «${CANCEL_KEYWORD}».`);
                    return;
                }

                await ctx.answerCallbackQuery({ text: 'Неизвестное действие' });
            }
        }
    }

    private async startOnboarding(
        ctx: BotContext,
        introText: string,
    ): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply('Не удалось определить пользователя Telegram.');
            return;
        }

        this.onboardingSessions.set(telegramId, {
            step: OnboardingStep.WAITING_CONTACT,
            data: {},
        });

        const contactKeyboard = new Keyboard()
            .requestContact('Поделиться контактом')
            .resized()
            .oneTime();

        await ctx.reply(introText);
        await ctx.reply('Нажмите кнопку ниже, чтобы отправить контакт:', {
            reply_markup: contactKeyboard,
        });
    }

    private async handleReplyButton(ctx: BotContext, telegramId: string, text: string): Promise<boolean> {
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) return false;

        const pet = await this.petsService.findFirstByUser(user);

        switch (text) {
            case REPLY_BUTTONS.WALK: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                this.pendingEventSessions.delete(telegramId);
                this.walkLogSessions.set(telegramId, { step: WalkLogStep.WAITING_DURATION_MINUTES, data: {} });
                await ctx.reply(`Сколько примерно гуляли (в минутах)?\nДля отмены: «${CANCEL_KEYWORD}»`);
                return true;
            }
            case REPLY_BUTTONS.FOOD: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                await this.petEventsService.createEvent({ owner: user, pet, type: PetEventType.FOOD, value: { foodType: 'Быстрая отметка', amount: '', appetite: 'good', note: null } as FoodEventValue });
                await ctx.reply('✅ Кормление записано.');
                return true;
            }
            case REPLY_BUTTONS.WEIGHT: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                this.pendingEventSessions.set(telegramId, { type: PetEventType.WEIGHT });
                await ctx.reply(`Введите вес в кг (например, 12.5) или «${CANCEL_KEYWORD}».`);
                return true;
            }
            case REPLY_BUTTONS.NOTE: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                this.pendingEventSessions.set(telegramId, { type: PetEventType.NOTE });
                await ctx.reply(`Введите текст заметки или «${CANCEL_KEYWORD}».`);
                return true;
            }
            case REPLY_BUTTONS.STATS: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                const events = await this.petEventsService.getTodayEventsForUser(user);
                await ctx.reply(this.buildTodayStats(events));
                return true;
            }
            case REPLY_BUTTONS.PETS: {
                const pets = await this.petsService.findAllByUser(user);
                if (pets.length === 0) {
                    await ctx.reply('У вас нет питомцев. Добавьте через /add_pet.');
                    return true;
                }

                for (const p of pets) {
                    const role = await this.petsService.getUserRoleForPet(user, p);
                    const lines = [`🐾 *${this.escMd(p.name)}*`];
                    if (p.breed) lines.push(`Порода: ${this.escMd(p.breed)}`);
                    if (p.age) lines.push(`Возраст: ${this.escMd(p.age)}`);
                    if (p.weightKg) lines.push(`Вес: ${this.escMd(String(p.weightKg))} кг`);
                    if (p.note) lines.push(`Заметка: ${this.escMd(p.note)}`);
                    lines.push(`Роль: ${role ?? '—'}`);

                    const buttons: { text: string; callback_data: string }[][] = [];
                    if (role === PetMemberRole.OWNER) {
                        buttons.push([
                            { text: '✏️ Редактировать', callback_data: `edit_pet_${p.id}` },
                            { text: '📷 Аватар', callback_data: `avatar_pet_${p.id}` },
                        ]);
                    }

                    // Send photo if avatar exists, otherwise text
                    const avatarData = await this.petsService.getAvatar(p.id);
                    if (avatarData) {
                        await ctx.replyWithPhoto(
                            new InputFile(avatarData.data, `avatar.${avatarData.mime.split('/')[1] ?? 'jpg'}`),
                            {
                                caption: lines.join('\n'),
                                parse_mode: 'MarkdownV2',
                                reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined,
                            },
                        );
                    } else {
                        await ctx.reply(lines.join('\n'), {
                            parse_mode: 'MarkdownV2',
                            reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined,
                        });
                    }
                }

                if (pets.length < 10) {
                    await ctx.reply('Добавить ещё: /add_pet');
                }
                return true;
            }
            case REPLY_BUTTONS.INVITE: {
                if (!pet) { await ctx.reply('Сначала добавьте питомца: /add_pet'); return true; }
                const role = await this.petsService.getUserRoleForPet(user, pet);
                if (role !== PetMemberRole.OWNER) {
                    await ctx.reply('Только владелец может приглашать участников.');
                    return true;
                }
                const invite = await this.petsService.createInvite({ pet, role: PetMemberRole.CAREGIVER, tag: null, expiresAt: null });
                const botUsername = this.configService.get<string>('bot.username')?.trim() ?? '';
                const link = `https://t.me/${botUsername}?start=join_${invite.id}`;
                await ctx.reply(
                    `🔗 Ссылка-приглашение для ${pet.name} (роль: CAREGIVER):\n\n${link}\n\nОтправьте её человеку — он нажмёт Start и получит доступ.`,
                );
                return true;
            }
            case REPLY_BUTTONS.MINIAPP: {
                const miniAppUrl = this.configService.get<string>('bot.miniAppUrl') ?? '';
                if (!miniAppUrl) {
                    await ctx.reply('Мини-приложение не настроено.');
                    return true;
                }
                await ctx.reply('Откройте мини-приложение:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 Открыть Rix Logger', web_app: { url: miniAppUrl } }],
                        ],
                    },
                });
                return true;
            }
            default:
                return false;
        }
    }

    private async sendMainMenu(ctx: BotContext): Promise<void> {
        const miniAppUrl = this.configService.get<string>('bot.miniAppUrl') ?? '';

        const replyKeyboard = new Keyboard()
            .text(REPLY_BUTTONS.WALK).text(REPLY_BUTTONS.FOOD).row()
            .text(REPLY_BUTTONS.WEIGHT).text(REPLY_BUTTONS.NOTE).row()
            .text(REPLY_BUTTONS.STATS).text(REPLY_BUTTONS.PETS).row()
            .text(REPLY_BUTTONS.INVITE).text(REPLY_BUTTONS.MINIAPP)
            .resized().persistent();

        await ctx.reply('Главное меню — выберите действие:', {
            reply_markup: replyKeyboard,
        });
    }

    private buildOnboardingSummary(pet: Pet): string {
        return [
            'Регистрация завершена.',
            'Короткое резюме:',
            `Имя: ${pet.name}`,
            `Возраст: ${pet.age ?? 'не указано'}`,
            `Порода: ${pet.breed ?? 'не указано'}`,
            `Вес: ${pet.weightKg ? `${pet.weightKg} кг` : 'не указано'}`,
            `Заметка: ${pet.note ?? 'не указано'}`,
        ].join('\n');
    }

    private buildTodayStats(events: PetEvent[]): string {
        const walkCount = events.filter((event) => event.type === PetEventType.WALK).length;
        const foodCount = events.filter((event) => event.type === PetEventType.FOOD).length;
        const weightEvents = events.filter(
            (event) => event.type === PetEventType.WEIGHT,
        );
        const noteCount = events.filter((event) => event.type === PetEventType.NOTE).length;

        const latestWeight = weightEvents.at(-1)?.value as WeightEventValue | undefined;

        return [
            'Статистика за 24 ч:',
            `Прогулки: ${walkCount}`,
            `Кормления: ${foodCount}`,
            `Записи веса: ${weightEvents.length}`,
            `Заметки: ${noteCount}`,
            `Последний вес: ${latestWeight ? `${latestWeight.kg} кг` : 'нет данных'}`,
        ].join('\n');
    }

    private getTelegramId(ctx: BotContext): string | null {
        return ctx.from ? String(ctx.from.id) : null;
    }

    private getDisplayName(user: User): string {
        if (user.firstName) {
            return user.firstName;
        }
        if (user.username) {
            return `@${user.username}`;
        }
        return 'друг';
    }

    private normalizeOptionalText(text: string): string | null {
        if (!text || text.toLowerCase() === SKIP_KEYWORD) {
            return null;
        }
        return text;
    }

    private parseWeight(raw: string): number | null {
        const normalized = raw.replace(',', '.').trim();
        const parsed = Number.parseFloat(normalized);

        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }

        return parsed;
    }

    private parseDurationMinutes(raw: string): number | null {
        const parsed = Number.parseInt(raw.trim(), 10);

        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 720) {
            return null;
        }

        return parsed;
    }

    private parseYesNo(raw: string): boolean | null {
        const normalized = raw.trim().toLowerCase();

        if (['да', 'д', 'yes', 'y'].includes(normalized)) {
            return true;
        }

        if (['нет', 'н', 'no', 'n'].includes(normalized)) {
            return false;
        }

        return null;
    }

    private escMd(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    }

    private normalizeTime(raw: string): string | null {
        const normalized = raw.trim().toLowerCase();

        if (normalized === 'сейчас') {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        const match = raw.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!match) {
            return null;
        }

        const hours = match[1].padStart(2, '0');
        const minutes = match[2];

        return `${hours}:${minutes}`;
    }

    private computeStartTime(endTime: string, durationMinutes: number): string {
        const [eh, em] = endTime.split(':').map(Number);
        let totalMin = eh * 60 + em - durationMinutes;
        if (totalMin < 0) totalMin += 1440;
        const h = Math.floor(totalMin / 60) % 24;
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    private getStartPayload(ctx: BotContext): string | null {
        if (!ctx.message || !('text' in ctx.message)) {
            return null;
        }

        const text = ctx.message.text?.trim();
        if (!text) {
            return null;
        }

        const match = text.match(/^\/start(?:@\w+)?\s+(.+)$/);
        return match ? match[1].trim() : null;
    }

    // ─── Photo / Avatar ───

    private async handleSetAvatarCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) return;
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) { await ctx.reply('Сначала /start'); return; }
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply('Нет питомцев. /add_pet'); return; }
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) { await ctx.reply('Только владелец может менять аватар.'); return; }
        this.awaitingPetAvatar.set(telegramId, pet.id);
        await ctx.reply(`Отправьте фото для аватара ${pet.name} или «${CANCEL_KEYWORD}».`);
    }

    private async handlePhotoMessage(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.message?.photo) return;

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) { await ctx.reply('Сначала /start.'); return; }

        // Get the largest photo variant
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        const file = await ctx.api.getFile(largest.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.configService.get<string>('bot.token')}/${file.file_path}`;
        const response = await fetch(fileUrl);
        if (!response.ok) { await ctx.reply('Не удалось загрузить фото.'); return; }
        const buffer = Buffer.from(await response.arrayBuffer());
        const mime = response.headers.get('content-type') ?? 'image/jpeg';

        // If awaiting pet avatar
        const avatarPetId = this.awaitingPetAvatar.get(telegramId);
        if (avatarPetId) {
            this.awaitingPetAvatar.delete(telegramId);
            const pet = await this.petsService.findById(avatarPetId);
            if (!pet) { await ctx.reply('Питомец не найден.'); return; }
            await this.petsService.setAvatar(pet, buffer, mime);
            await ctx.reply(`✅ Аватар ${pet.name} обновлён.`);
            await this.sendMainMenu(ctx);
            return;
        }

        // Otherwise attach to last today event for this user
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply('Нет питомцев.'); return; }

        const todayEvents = await this.petEventsService.getTodayEventsForUser(user);
        const lastEvent = todayEvents.at(-1);
        if (!lastEvent) {
            await ctx.reply('Нет недавних событий, к которым можно прикрепить фото. Сначала запишите событие.');
            return;
        }

        const count = await this.petEventsService.countImages(lastEvent.id);
        if (count >= 10) {
            await ctx.reply('К этому событию уже прикреплено 10 фото (максимум).');
            return;
        }

        await this.petEventsService.addImage(lastEvent, buffer, mime);
        await ctx.reply(`📎 Фото прикреплено к последнему событию (${lastEvent.type}).`);
    }
}
