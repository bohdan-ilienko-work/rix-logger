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
import { t, tList, toLang, Lang } from './i18n';

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

    /** Resolve language: from User entity or from Telegram context */
    private getLang(ctx: BotContext, user?: User | null): Lang {
        if (user?.lang) return toLang(user.lang);
        return toLang(ctx.from?.language_code);
    }

    /** Check if text matches cancel keyword in any supported language */
    private isCancel(text: string): boolean {
        const lc = text.toLowerCase();
        return lc === 'отмена' || lc === 'cancel' || lc === 'скасувати';
    }

    /** Check if text matches skip keyword in any supported language */
    private isSkip(text: string): boolean {
        const lc = text.toLowerCase();
        return lc === 'пропустить' || lc === 'skip' || lc === 'пропустити';
    }

    /** Check if text matches "now" keyword in any supported language */
    private isNow(text: string): boolean {
        const lc = text.trim().toLowerCase();
        return lc === 'сейчас' || lc === 'now' || lc === 'зараз';
    }

    /** Resolve reply button key from localized text */
    private matchReplyButton(text: string): keyof typeof REPLY_BUTTONS | 'LANG' | null {
        const map: Record<keyof typeof REPLY_BUTTONS | 'LANG', string> = {
            WALK: 'replyWalk',
            FOOD: 'replyFood',
            WEIGHT: 'replyWeight',
            NOTE: 'replyNote',
            STATS: 'replyStats',
            PETS: 'replyPets',
            INVITE: 'replyInvite',
            MINIAPP: 'replyMiniapp',
            LANG: 'replyLang',
        };
        for (const [btnKey, i18nKey] of Object.entries(map)) {
            for (const lang of ['ru', 'en', 'uk'] as Lang[]) {
                if (t(i18nKey as any, lang) === text) return btnKey as keyof typeof REPLY_BUTTONS | 'LANG';
            }
        }
        return null;
    }

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

        this.bot.command('lang', async (ctx) => {
            await this.handleLangCommand(ctx);
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
            await ctx.reply(t('errorNoTelegramUser', this.getLang(ctx)));
            return;
        }

        const startPayload = this.getStartPayload(ctx);
        if (startPayload?.startsWith('join_')) {
            await this.handleInviteJoin(ctx, telegramId, startPayload.slice(5));
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        const pet = user ? await this.petsService.findFirstByUser(user) : null;

        if (user) {
            this.awaitingAddPetDecision.delete(telegramId);
            this.onboardingSessions.delete(telegramId);
            this.pendingEventSessions.delete(telegramId);

            if (pet) {
                await ctx.reply(
                    t('welcomeBack', lang, { name: this.getDisplayName(user, lang), petName: pet.name }),
                );
                await this.sendMainMenu(ctx, lang);
                return;
            }

            await ctx.reply(t('accountReadyNoPet', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        const lang2 = this.getLang(ctx);
        this.awaitingAddPetDecision.set(telegramId, true);
        await ctx.reply(t('addPetDecisionPrompt', lang2));
    }

    private async handleAddPetCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply(t('errorNoTelegramUser', this.getLang(ctx)));
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        if (!user) {
            await this.startOnboarding(ctx, t('addPetShareContactFirst', lang), lang);
            return;
        }

        this.onboardingSessions.set(telegramId, {
            step: OnboardingStep.WAITING_PET_NAME,
            data: {},
        });

        await ctx.reply(t('askPetName', lang));
    }

    private async handleInviteJoin(
        ctx: BotContext,
        telegramId: string,
        inviteId: string,
    ): Promise<void> {
        const detectedLang = toLang(ctx.from?.language_code);
        const user =
            (await this.usersService.findByTelegramId(telegramId)) ??
            (await this.usersService.createOrUpdateFromTelegramContact({
                telegramId,
                username: ctx.from?.username,
                firstName: ctx.from?.first_name,
                lastName: ctx.from?.last_name,
                lang: detectedLang,
            }));

        const lang = this.getLang(ctx, user);

        const invite = await this.petsService.findInviteById(inviteId);
        if (!invite) {
            await ctx.reply(t('inviteLinkInvalid', lang));
            return;
        }

        if (invite.expiresAt && Date.now() > Number(invite.expiresAt)) {
            await ctx.reply(t('inviteLinkExpired', lang));
            return;
        }

        const pet = invite.pet;
        if (!pet) {
            await ctx.reply(t('invitePetNotFound', lang));
            return;
        }

        // Don't downgrade existing role (e.g. OWNER clicking own invite link)
        const existingRole = await this.petsService.getUserRoleForPet(user, pet);
        if (existingRole) {
            const roleHierarchy: Record<string, number> = { OWNER: 5, VET: 4, TRAINER: 3, CAREGIVER: 2, OBSERVER: 1 };
            const existingLevel = roleHierarchy[existingRole] ?? 0;
            const inviteLevel = roleHierarchy[invite.role] ?? 0;
            if (existingLevel >= inviteLevel) {
                await ctx.reply(t('alreadyHasAccessNoDowngrade', lang, { petName: pet.name, role: existingRole }));
                await this.sendMainMenu(ctx, lang);
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

        await ctx.reply(t('inviteJoinSuccess', lang, { petName: pet.name, role: invite.role }));
        await this.sendMainMenu(ctx, lang);
    }

    private async handleRestartOnboardingCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply(t('errorNoTelegramUser', this.getLang(ctx)));
            return;
        }

        const lang = this.getLang(ctx);
        this.onboardingSessions.delete(telegramId);
        this.pendingEventSessions.delete(telegramId);
        this.walkLogSessions.delete(telegramId);
        this.awaitingAddPetDecision.delete(telegramId);
        this.pendingInviteTokens.delete(telegramId);

        await this.startOnboarding(ctx, t('restartOnboardingIntro', lang), lang);
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
        const lang = this.getLang(ctx, user);
        if (!user) {
            await ctx.reply(t('sharePetStartFirst', lang));
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) {
            await ctx.reply(t('sharePetNoPets', lang));
            return;
        }

        const currentRole = await this.petsService.getUserRoleForPet(user, pet);
        if (currentRole !== PetMemberRole.OWNER) {
            await ctx.reply(t('sharePetOnlyOwner', lang));
            return;
        }

        const [_, targetTelegramIdRaw, roleRaw, ...tagParts] = commandText.trim().split(/\s+/);

        if (!targetTelegramIdRaw) {
            await ctx.reply(t('sharePetUsage', lang));
            return;
        }

        const targetUser = await this.usersService.findByTelegramId(targetTelegramIdRaw);
        if (!targetUser) {
            await ctx.reply(t('sharePetUserNotFound', lang));
            return;
        }

        const parsedRole = this.parseMemberRole(roleRaw);
        if (!parsedRole) {
            await ctx.reply(t('sharePetUnknownRole', lang));
            return;
        }

        await this.petsService.addOrUpdateMember({
            pet,
            user: targetUser,
            role: parsedRole,
            tag: tagParts.length > 0 ? tagParts.join(' ') : null,
        });

        await ctx.reply(t('sharePetSuccess', lang, { petName: pet.name, telegramId: targetTelegramIdRaw, role: parsedRole }));
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

        const lang = this.getLang(ctx);

        if (contact.user_id && String(contact.user_id) !== telegramId) {
            await ctx.reply(t('contactPleaseShareOwn', lang));
            return;
        }

        const user = await this.usersService.createOrUpdateFromTelegramContact({
            telegramId,
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
            phoneNumber: contact.phone_number,
            lang,
        });

        const pendingInviteToken = this.pendingInviteTokens.get(telegramId);
        if (pendingInviteToken) {
            const invite = await this.petsService.findInviteById(pendingInviteToken);
            this.pendingInviteTokens.delete(telegramId);

            if (!invite || (invite.expiresAt && Date.now() > Number(invite.expiresAt))) {
                await ctx.reply(
                    t('contactInviteExpiredFallback', lang),
                    { reply_markup: { remove_keyboard: true } },
                );
            } else {
                const pet = invite.pet;
                if (!pet) {
                    await ctx.reply(
                        t('contactInvitePetNotFoundFallback', lang),
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
                        t('contactInviteJoinSuccess', lang, { petName: pet.name, role: invite.role }),
                        { reply_markup: { remove_keyboard: true } },
                    );
                    await this.sendMainMenu(ctx, lang);
                    return;
                }
            }
        }

        this.onboardingSessions.set(telegramId, {
            ...session,
            step: OnboardingStep.WAITING_PET_NAME,
        });

        await ctx.reply(t('contactSavedAskPetName', lang), {
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
        if (this.awaitingPetAvatar.has(telegramId) && this.isCancel(text)) {
            this.awaitingPetAvatar.delete(telegramId);
            const user = await this.usersService.findByTelegramId(telegramId);
            const lang = this.getLang(ctx, user);
            await ctx.reply(t('avatarSetCancelled', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        if (this.awaitingAddPetDecision.get(telegramId)) {
            const lang = this.getLang(ctx);
            const normalized = text.toLowerCase();
            const yesWords = tList('yesWords', lang);
            const noWords = tList('noWords', lang);

            if (yesWords.includes(normalized)) {
                this.awaitingAddPetDecision.delete(telegramId);
                await this.startOnboarding(ctx, t('addPetYesResponse', lang), lang);
                return;
            }

            if (noWords.includes(normalized)) {
                this.awaitingAddPetDecision.delete(telegramId);

                await this.usersService.createOrUpdateFromTelegramContact({
                    telegramId,
                    username: ctx.from?.username,
                    firstName: ctx.from?.first_name,
                    lastName: ctx.from?.last_name,
                    lang,
                });

                await ctx.reply(t('addPetNoResponse', lang));
                await this.sendMainMenu(ctx, lang);
                return;
            }

            await ctx.reply(t('addPetDecisionRepeat', lang));
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
            await ctx.reply(t('errorUnknownMessage', this.getLang(ctx)));
            return;
        }

        await this.handleOnboardingStep(ctx, telegramId, text, onboarding);
    }

    private async handleEditPetCommand(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) return;
        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        if (!user) { await ctx.reply(t('editPetStartFirst', lang)); return; }
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply(t('editPetNoPets', lang)); return; }
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) { await ctx.reply(t('editPetOnlyOwner', lang)); return; }
        this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId: pet.id });
        await ctx.reply(t('editPetPrompt', lang, { petName: pet.name, cancel: t('cancelKeyword', lang) }));
    }

    private async handleEditPetInput(ctx: BotContext, telegramId: string, text: string, session: EditPetSession): Promise<void> {
        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);

        if (this.isCancel(text)) {
            this.editPetSessions.delete(telegramId);
            await ctx.reply(t('editPetCancelled', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        if (!user) { this.editPetSessions.delete(telegramId); return; }
        const pet = await this.petsService.findById(session.petId);
        if (!pet) { this.editPetSessions.delete(telegramId); await ctx.reply(t('editPetNotFound', lang)); return; }

        if (session.step === EditPetStep.WAITING_FIELD_CHOICE) {
            const fields: Record<string, 'name' | 'age' | 'breed' | 'weightKg' | 'note'> = { '1': 'name', '2': 'age', '3': 'breed', '4': 'weightKg', '5': 'note' };
            const field = fields[text.trim()];
            if (!field) { await ctx.reply(t('editPetInvalidChoice', lang)); return; }
            this.editPetSessions.set(telegramId, { ...session, step: EditPetStep.WAITING_NEW_VALUE, field });
            const labelKeys: Record<string, string> = { name: 'editPetFieldName', age: 'editPetFieldAge', breed: 'editPetFieldBreed', weightKg: 'editPetFieldWeight', note: 'editPetFieldNote' };
            await ctx.reply(t('editPetEnterNewValue', lang, { field: t(labelKeys[field] as any, lang), cancel: t('cancelKeyword', lang) }));
            return;
        }

        if (session.step === EditPetStep.WAITING_NEW_VALUE && session.field) {
            const payload: Record<string, unknown> = {};
            if (session.field === 'weightKg') {
                const w = this.parseWeight(text);
                if (w === null) { await ctx.reply(t('editPetInvalidWeight', lang)); return; }
                payload.weightKg = w;
            } else {
                payload[session.field] = text.trim();
            }
            await this.petsService.updatePet(pet, payload);
            this.editPetSessions.delete(telegramId);
            await ctx.reply(t('editPetSuccess', lang, { petName: pet.name }));
            await this.sendMainMenu(ctx, lang);
        }
    }

    private async handleEditEventInput(ctx: BotContext, telegramId: string, text: string, session: EditEventSession): Promise<void> {
        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);

        if (this.isCancel(text)) {
            this.editEventSessions.delete(telegramId);
            await ctx.reply(t('editEventCancelled', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }
        const event = await this.petEventsService.findById(session.eventId);
        if (!event) { this.editEventSessions.delete(telegramId); await ctx.reply(t('editEventNotFound', lang)); return; }

        // For bot editing, update the text/note field based on type
        let newValue = event.value;
        switch (event.type) {
            case PetEventType.NOTE:
                newValue = { text: text.trim() } as NoteEventValue;
                break;
            case PetEventType.WEIGHT: {
                const kg = this.parseWeight(text);
                if (kg === null) { await ctx.reply(t('editEventInvalidWeight', lang)); return; }
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
        await ctx.reply(t('editEventSuccess', lang));
        await this.sendMainMenu(ctx, lang);
    }

    private async handleOnboardingStep(
        ctx: BotContext,
        telegramId: string,
        text: string,
        session: OnboardingSession,
    ): Promise<void> {
        const lang = this.getLang(ctx);
        const skip = t('skipKeyword', lang);
        const cancel = t('cancelKeyword', lang);

        switch (session.step) {
            case OnboardingStep.WAITING_CONTACT: {
                await ctx.reply(t('onboardingWaitContact', lang));
                return;
            }

            case OnboardingStep.WAITING_PET_NAME: {
                if (!text || this.isSkip(text)) {
                    await ctx.reply(t('onboardingPetNameRequired', lang));
                    return;
                }

                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_AGE,
                    data: { ...session.data, name: text },
                });

                await ctx.reply(t('onboardingAskAge', lang, { skip }));
                return;
            }

            case OnboardingStep.WAITING_PET_AGE: {
                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_BREED,
                    data: { ...session.data, age: this.normalizeOptionalText(text) },
                });

                await ctx.reply(t('onboardingAskBreed', lang, { skip }));
                return;
            }

            case OnboardingStep.WAITING_PET_BREED: {
                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_WEIGHT,
                    data: { ...session.data, breed: this.normalizeOptionalText(text) },
                });

                await ctx.reply(t('onboardingAskWeight', lang, { skip }));
                return;
            }

            case OnboardingStep.WAITING_PET_WEIGHT: {
                let weightKg: number | null = null;

                if (!this.isSkip(text)) {
                    const parsedWeight = this.parseWeight(text);
                    if (parsedWeight === null) {
                        await ctx.reply(t('onboardingWeightParseError', lang, { skip }));
                        return;
                    }
                    weightKg = parsedWeight;
                }

                this.onboardingSessions.set(telegramId, {
                    step: OnboardingStep.WAITING_PET_NOTE,
                    data: { ...session.data, weightKg },
                });

                await ctx.reply(t('onboardingAskNote', lang, { skip }));
                return;
            }

            case OnboardingStep.WAITING_PET_NOTE: {
                const user = await this.usersService.findByTelegramId(telegramId);
                if (!user) {
                    await this.startOnboarding(ctx, t('onboardingUserNotFoundRestart', lang), lang);
                    return;
                }

                const finalPetData = {
                    ...session.data,
                    note: this.normalizeOptionalText(text),
                };

                if (!finalPetData.name) {
                    await this.startOnboarding(ctx, t('onboardingPetNameLostRestart', lang), lang);
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

                await ctx.reply(this.buildOnboardingSummary(pet, lang));

                this.onboardingSessions.delete(telegramId);
                await this.sendMainMenu(ctx, lang);
                return;
            }

            case OnboardingStep.COMPLETED: {
                this.onboardingSessions.delete(telegramId);
                await this.sendMainMenu(ctx, lang);
                return;
            }

            default: {
                await ctx.reply(t('onboardingStepError', lang));
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
        const lang = this.getLang(ctx, user);
        if (!user) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(t('pendingEventStartFirst', lang));
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(t('pendingEventNoPets', lang));
            return;
        }

        if (this.isCancel(text)) {
            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(t('pendingEventCancelled', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        if (pendingEvent.type === PetEventType.WEIGHT) {
            const weight = this.parseWeight(text);
            if (weight === null) {
                await ctx.reply(t('pendingWeightParseError', lang, { cancel: t('cancelKeyword', lang) }));
                return;
            }

            await this.petEventsService.createEvent({
                owner: user,
                pet,
                type: PetEventType.WEIGHT,
                value: { kg: weight } as WeightEventValue,
            });

            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(t('pendingWeightSaved', lang, { v: weight.toFixed(2) }));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        if (pendingEvent.type === PetEventType.NOTE) {
            if (!text) {
                await ctx.reply(t('pendingNoteEmpty', lang, { cancel: t('cancelKeyword', lang) }));
                return;
            }

            await this.petEventsService.createEvent({
                owner: user,
                pet,
                type: PetEventType.NOTE,
                value: { text } as NoteEventValue,
            });

            this.pendingEventSessions.delete(telegramId);
            await ctx.reply(t('pendingNoteSaved', lang));
            await this.sendMainMenu(ctx, lang);
        }
    }

    private async handleWalkLogInput(
        ctx: BotContext,
        telegramId: string,
        text: string,
        walkSession: WalkLogSession,
    ): Promise<void> {
        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        if (!user) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply(t('pendingEventStartFirst', lang));
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply(t('pendingEventNoPets', lang));
            return;
        }

        if (this.isCancel(text)) {
            this.walkLogSessions.delete(telegramId);
            await ctx.reply(t('walkCancelled', lang));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        const cancel = t('cancelKeyword', lang);
        const now = t('timeNow', lang);
        const skip = t('skipKeyword', lang);

        switch (walkSession.step) {
            case WalkLogStep.WAITING_DURATION_MINUTES: {
                const durationMinutes = this.parseDurationMinutes(text);
                if (durationMinutes === null) {
                    await ctx.reply(t('walkDurationParseError', lang, { cancel }));
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_END_TIME,
                    data: { ...walkSession.data, durationMinutes },
                });

                await ctx.reply(t('walkAskEndTime', lang, { now, cancel }));
                return;
            }

            case WalkLogStep.WAITING_END_TIME: {
                const endTime = this.normalizeTime(text);
                if (!endTime) {
                    await ctx.reply(t('walkEndTimeParseError', lang, { now, cancel }));
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_POOP,
                    data: { ...walkSession.data, endTime },
                });

                await ctx.reply(t('walkAskPoop', lang));
                return;
            }

            case WalkLogStep.WAITING_POOP: {
                const pooped = this.parseYesNo(text, lang);
                if (pooped === null) {
                    await ctx.reply(t('walkYesNoParseError', lang, { cancel }));
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_PEE,
                    data: { ...walkSession.data, pooped },
                });

                await ctx.reply(t('walkAskPee', lang));
                return;
            }

            case WalkLogStep.WAITING_PEE: {
                const peed = this.parseYesNo(text, lang);
                if (peed === null) {
                    await ctx.reply(t('walkYesNoParseError', lang, { cancel }));
                    return;
                }

                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_NOTE,
                    data: { ...walkSession.data, peed },
                });

                await ctx.reply(t('walkAskNote', lang, { skip }));
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
                    await ctx.reply(t('walkSaveError', lang));
                    await this.sendMainMenu(ctx, lang);
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
                    t('walkSaved', lang, {
                        start: startTime,
                        end: finalData.endTime,
                        dur: finalData.durationMinutes,
                        pooped: finalData.pooped ? t('yes', lang) : t('no', lang),
                        peed: finalData.peed ? t('yes', lang) : t('no', lang),
                    }),
                );
                await this.sendMainMenu(ctx, lang);
                return;
            }

            default: {
                this.walkLogSessions.delete(telegramId);
                await ctx.reply(t('walkStepError', lang));
                await this.sendMainMenu(ctx, lang);
            }
        }
    }

    private async handleCallbackQuery(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.callbackQuery) {
            return;
        }

        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        if (!user) {
            await ctx.answerCallbackQuery({ text: t('pendingEventStartFirst', lang) });
            return;
        }

        const pet = await this.petsService.findFirstByUser(user);

        if (!pet) {
            await ctx.answerCallbackQuery();
            await ctx.reply(t('pendingEventNoPets', lang));
            return;
        }

        const cancel = t('cancelKeyword', lang);

        switch (ctx.callbackQuery.data) {
            case MENU_CALLBACKS.WALK: {
                this.pendingEventSessions.delete(telegramId);
                this.walkLogSessions.set(telegramId, {
                    step: WalkLogStep.WAITING_DURATION_MINUTES,
                    data: {},
                });

                await ctx.answerCallbackQuery({ text: t('cbWalkStartToast', lang) });
                await ctx.reply(t('walkAskDuration', lang, { cancel }));
                return;
            }

            case MENU_CALLBACKS.FOOD: {
                await this.petEventsService.createEvent({
                    owner: user,
                    pet,
                    type: PetEventType.FOOD,
                    value: { foodType: t('cbFoodQuickValue', lang), amount: '', appetite: 'good', note: null } as FoodEventValue,
                });
                await ctx.answerCallbackQuery({ text: t('cbFoodRecordedToast', lang) });
                await ctx.reply(t('cbFoodRecordedMessage', lang));
                return;
            }

            case MENU_CALLBACKS.WEIGHT: {
                this.pendingEventSessions.set(telegramId, { type: PetEventType.WEIGHT });
                await ctx.answerCallbackQuery();
                await ctx.reply(t('cbWeightAsk', lang, { cancel }));
                return;
            }

            case MENU_CALLBACKS.NOTE: {
                this.pendingEventSessions.set(telegramId, { type: PetEventType.NOTE });
                await ctx.answerCallbackQuery();
                await ctx.reply(t('cbNoteAsk', lang, { cancel }));
                return;
            }

            case MENU_CALLBACKS.STATS_TODAY: {
                const events = await this.petEventsService.getTodayEventsForUser(user);
                await ctx.answerCallbackQuery();
                await ctx.reply(this.buildTodayStats(events, lang));
                return;
            }

            case MENU_CALLBACKS.EDIT_PET: {
                const role = await this.petsService.getUserRoleForPet(user, pet);
                if (role !== PetMemberRole.OWNER) {
                    await ctx.answerCallbackQuery({ text: t('cbOnlyOwner', lang) });
                    return;
                }
                this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId: pet.id });
                await ctx.answerCallbackQuery();
                await ctx.reply(t('editPetPrompt', lang, { petName: pet.name, cancel }));
                return;
            }

            case MENU_CALLBACKS.DELETE_LAST_EVENT: {
                const todayEvents = await this.petEventsService.getTodayEventsForUser(user);
                const lastEvent = todayEvents.at(-1);
                if (!lastEvent) {
                    await ctx.answerCallbackQuery({ text: t('cbNoEventsToday', lang) });
                    return;
                }
                await this.petEventsService.deleteEvent(lastEvent);
                await ctx.answerCallbackQuery({ text: t('cbLastEventDeletedToast', lang) });
                await ctx.reply(t('cbLastEventDeletedMessage', lang, { type: lastEvent.type }));
                return;
            }

            default: {
                // Handle dynamic callbacks like edit_pet_<uuid>, avatar_pet_<uuid>
                const cbData = ctx.callbackQuery.data ?? '';

                if (cbData.startsWith('set_lang_')) {
                    const newLang = cbData.slice('set_lang_'.length) as Lang;
                    if (!['ru', 'en', 'uk', 'bg', 'pl', 'de'].includes(newLang)) {
                        await ctx.answerCallbackQuery();
                        return;
                    }
                    await this.usersService.updateLang(telegramId, newLang);
                    await ctx.answerCallbackQuery({ text: t('langChanged', newLang) });
                    await ctx.reply(t('langChanged', newLang));
                    await this.sendMainMenu(ctx, newLang);
                    return;
                }

                if (cbData.startsWith('edit_pet_')) {
                    const petId = cbData.slice('edit_pet_'.length);
                    const targetPet = await this.petsService.findById(petId);
                    if (!targetPet) {
                        await ctx.answerCallbackQuery({ text: t('cbPetNotFound', lang) });
                        return;
                    }
                    const role = await this.petsService.getUserRoleForPet(user, targetPet);
                    if (role !== PetMemberRole.OWNER) {
                        await ctx.answerCallbackQuery({ text: t('cbOnlyOwner', lang) });
                        return;
                    }
                    this.editPetSessions.set(telegramId, { step: EditPetStep.WAITING_FIELD_CHOICE, petId });
                    await ctx.answerCallbackQuery();
                    await ctx.reply(t('editPetPrompt', lang, { petName: targetPet.name, cancel }));
                    return;
                }

                if (cbData.startsWith('avatar_pet_')) {
                    const petId = cbData.slice('avatar_pet_'.length);
                    const targetPet = await this.petsService.findById(petId);
                    if (!targetPet) {
                        await ctx.answerCallbackQuery({ text: t('cbPetNotFound', lang) });
                        return;
                    }
                    const role = await this.petsService.getUserRoleForPet(user, targetPet);
                    if (role !== PetMemberRole.OWNER) {
                        await ctx.answerCallbackQuery({ text: t('cbOnlyOwner', lang) });
                        return;
                    }
                    this.awaitingPetAvatar.set(telegramId, petId);
                    await ctx.answerCallbackQuery();
                    await ctx.reply(t('cbAvatarAskPhoto', lang, { petName: targetPet.name, cancel }));
                    return;
                }

                await ctx.answerCallbackQuery({ text: t('cbUnknownAction', lang) });
            }
        }
    }

    private async startOnboarding(
        ctx: BotContext,
        introText: string,
        lang?: Lang,
    ): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId) {
            await ctx.reply(t('errorNoTelegramUser', lang ?? this.getLang(ctx)));
            return;
        }

        const l = lang ?? this.getLang(ctx);

        this.onboardingSessions.set(telegramId, {
            step: OnboardingStep.WAITING_CONTACT,
            data: {},
        });

        const contactKeyboard = new Keyboard()
            .requestContact(t('shareContactButton', l))
            .resized()
            .oneTime();

        await ctx.reply(introText);
        await ctx.reply(t('shareContactPrompt', l), {
            reply_markup: contactKeyboard,
        });
    }

    private async handleReplyButton(ctx: BotContext, telegramId: string, text: string): Promise<boolean> {
        const btnKey = this.matchReplyButton(text);
        if (!btnKey) return false;

        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user) return false;

        const lang = this.getLang(ctx, user);
        const pet = await this.petsService.findFirstByUser(user);
        const cancel = t('cancelKeyword', lang);

        switch (btnKey) {
            case 'WALK': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                this.pendingEventSessions.delete(telegramId);
                this.walkLogSessions.set(telegramId, { step: WalkLogStep.WAITING_DURATION_MINUTES, data: {} });
                await ctx.reply(t('walkAskDuration', lang, { cancel }));
                return true;
            }
            case 'FOOD': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                await this.petEventsService.createEvent({ owner: user, pet, type: PetEventType.FOOD, value: { foodType: t('cbFoodQuickValue', lang), amount: '', appetite: 'good', note: null } as FoodEventValue });
                await ctx.reply(t('replyFoodRecorded', lang));
                return true;
            }
            case 'WEIGHT': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                this.pendingEventSessions.set(telegramId, { type: PetEventType.WEIGHT });
                await ctx.reply(t('replyWeightAsk', lang, { cancel }));
                return true;
            }
            case 'NOTE': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                this.pendingEventSessions.set(telegramId, { type: PetEventType.NOTE });
                await ctx.reply(t('replyNoteAsk', lang, { cancel }));
                return true;
            }
            case 'STATS': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                const events = await this.petEventsService.getTodayEventsForUser(user);
                await ctx.reply(this.buildTodayStats(events, lang));
                return true;
            }
            case 'PETS': {
                const pets = await this.petsService.findAllByUser(user);
                if (pets.length === 0) {
                    await ctx.reply(t('noPetsAddViaCommand', lang));
                    return true;
                }

                for (const p of pets) {
                    const role = await this.petsService.getUserRoleForPet(user, p);
                    const lines = [`🐾 *${this.escMd(p.name)}*`];
                    if (p.breed) lines.push(`${t('petInfoBreed', lang, { v: this.escMd(p.breed) })}`);
                    if (p.age) lines.push(`${t('petInfoAge', lang, { v: this.escMd(p.age) })}`);
                    if (p.weightKg) lines.push(`${t('petInfoWeight', lang, { v: this.escMd(String(p.weightKg)) })}`);
                    if (p.note) lines.push(`${t('petInfoNote', lang, { v: this.escMd(p.note) })}`);
                    lines.push(`${t('petInfoRole', lang, { v: role ?? '—' })}`);

                    const buttons: { text: string; callback_data: string }[][] = [];
                    if (role === PetMemberRole.OWNER) {
                        buttons.push([
                            { text: t('editPetButton', lang), callback_data: `edit_pet_${p.id}` },
                            { text: t('avatarButton', lang), callback_data: `avatar_pet_${p.id}` },
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
                    await ctx.reply(t('addMorePets', lang));
                }
                return true;
            }
            case 'INVITE': {
                if (!pet) { await ctx.reply(t('addPetFirst', lang)); return true; }
                const role = await this.petsService.getUserRoleForPet(user, pet);
                if (role !== PetMemberRole.OWNER) {
                    await ctx.reply(t('inviteOnlyOwner', lang));
                    return true;
                }
                const invite = await this.petsService.createInvite({ pet, role: PetMemberRole.CAREGIVER, tag: null, expiresAt: null });
                const botUsername = this.configService.get<string>('bot.username')?.trim() ?? '';
                const link = `https://t.me/${botUsername}?start=join_${invite.id}`;
                await ctx.reply(t('inviteLinkMessage', lang, { petName: pet.name, link }));
                return true;
            }
            case 'MINIAPP': {
                const miniAppUrl = this.configService.get<string>('bot.miniAppUrl') ?? '';
                if (!miniAppUrl) {
                    await ctx.reply(t('miniappNotConfigured', lang));
                    return true;
                }
                await ctx.reply(t('miniappOpenPrompt', lang), {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: t('miniappOpenButton', lang), web_app: { url: miniAppUrl } }],
                        ],
                    },
                });
                return true;
            }
            case 'LANG': {
                await this.handleLangCommand(ctx);
                return true;
            }
            default:
                return false;
        }
    }

    private async sendMainMenu(ctx: BotContext, lang?: Lang): Promise<void> {
        const l = lang ?? this.getLang(ctx);

        const replyKeyboard = new Keyboard()
            .text(t('replyWalk', l)).text(t('replyFood', l)).row()
            .text(t('replyWeight', l)).text(t('replyNote', l)).row()
            .text(t('replyStats', l)).text(t('replyPets', l)).row()
            .text(t('replyInvite', l)).text(t('replyMiniapp', l)).row()
            .text(t('replyLang', l))
            .resized().persistent();

        await ctx.reply(t('mainMenuPrompt', l), {
            reply_markup: replyKeyboard,
        });
    }

    private buildOnboardingSummary(pet: Pet, lang: Lang): string {
        const ns = t('notSpecified', lang);
        return [
            t('summaryTitle', lang),
            t('summarySubtitle', lang),
            t('summaryName', lang, { v: pet.name }),
            t('summaryAge', lang, { v: pet.age ?? ns }),
            t('summaryBreed', lang, { v: pet.breed ?? ns }),
            t('summaryWeight', lang, { v: pet.weightKg ? String(pet.weightKg) : ns }),
            t('summaryNote', lang, { v: pet.note ?? ns }),
        ].join('\n');
    }

    private buildTodayStats(events: PetEvent[], lang: Lang): string {
        const walkCount = events.filter((event) => event.type === PetEventType.WALK).length;
        const foodCount = events.filter((event) => event.type === PetEventType.FOOD).length;
        const weightEvents = events.filter(
            (event) => event.type === PetEventType.WEIGHT,
        );
        const noteCount = events.filter((event) => event.type === PetEventType.NOTE).length;

        const latestWeight = weightEvents.at(-1)?.value as WeightEventValue | undefined;

        return [
            t('statsTitle', lang),
            t('statsWalks', lang, { v: walkCount }),
            t('statsFeedings', lang, { v: foodCount }),
            t('statsWeightEntries', lang, { v: weightEvents.length }),
            t('statsNotes', lang, { v: noteCount }),
            t('statsLatestWeight', lang, { v: latestWeight ? `${latestWeight.kg}` : t('statsNoWeightData', lang) }),
        ].join('\n');
    }

    private getTelegramId(ctx: BotContext): string | null {
        return ctx.from ? String(ctx.from.id) : null;
    }

    private getDisplayName(user: User, lang?: Lang): string {
        if (user.firstName) {
            return user.firstName;
        }
        if (user.username) {
            return `@${user.username}`;
        }
        return t('displayNameFallback', lang ?? 'uk');
    }

    private normalizeOptionalText(text: string): string | null {
        if (!text || this.isSkip(text)) {
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

    private parseYesNo(raw: string, lang?: Lang): boolean | null {
        const normalized = raw.trim().toLowerCase();

        // Check all language variants for yes/no
        for (const l of ['ru', 'en', 'uk'] as Lang[]) {
            if (tList('yesWords', l).includes(normalized)) return true;
            if (tList('noWords', l).includes(normalized)) return false;
        }

        return null;
    }

    private escMd(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    }

    private normalizeTime(raw: string): string | null {
        if (this.isNow(raw)) {
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
        const lang = this.getLang(ctx, user);
        if (!user) { await ctx.reply(t('editPetStartFirst', lang)); return; }
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply(t('editPetNoPets', lang)); return; }
        const role = await this.petsService.getUserRoleForPet(user, pet);
        if (role !== PetMemberRole.OWNER) { await ctx.reply(t('setAvatarOnlyOwner', lang)); return; }
        this.awaitingPetAvatar.set(telegramId, pet.id);
        await ctx.reply(t('cbAvatarAskPhoto', lang, { petName: pet.name, cancel: t('cancelKeyword', lang) }));
    }

    private async handleLangCommand(ctx: BotContext): Promise<void> {
        const lang = this.getLang(ctx);
        await ctx.reply(t('langPrompt', lang), {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🇷🇺 Русский', callback_data: 'set_lang_ru' },
                    { text: '🇬🇧 English', callback_data: 'set_lang_en' },
                    { text: '🇺🇦 Українська', callback_data: 'set_lang_uk' },
                ], [
                    { text: '🇧🇬 Български', callback_data: 'set_lang_bg' },
                    { text: '🇵🇱 Polski', callback_data: 'set_lang_pl' },
                    { text: '🇩🇪 Deutsch', callback_data: 'set_lang_de' },
                ]],
            },
        });
    }

    private async handlePhotoMessage(ctx: BotContext): Promise<void> {
        const telegramId = this.getTelegramId(ctx);
        if (!telegramId || !ctx.message?.photo) return;

        const user = await this.usersService.findByTelegramId(telegramId);
        const lang = this.getLang(ctx, user);
        if (!user) { await ctx.reply(t('photoStartFirst', lang)); return; }

        // Get the largest photo variant
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        const file = await ctx.api.getFile(largest.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.configService.get<string>('bot.token')}/${file.file_path}`;
        const response = await fetch(fileUrl);
        if (!response.ok) { await ctx.reply(t('photoDownloadFailed', lang)); return; }
        const buffer = Buffer.from(await response.arrayBuffer());
        const mime = response.headers.get('content-type') ?? 'image/jpeg';

        // If awaiting pet avatar
        const avatarPetId = this.awaitingPetAvatar.get(telegramId);
        if (avatarPetId) {
            this.awaitingPetAvatar.delete(telegramId);
            const pet = await this.petsService.findById(avatarPetId);
            if (!pet) { await ctx.reply(t('cbPetNotFound', lang)); return; }
            await this.petsService.setAvatar(pet, buffer, mime);
            await ctx.reply(t('avatarUpdated', lang, { petName: pet.name }));
            await this.sendMainMenu(ctx, lang);
            return;
        }

        // Otherwise attach to last today event for this user
        const pet = await this.petsService.findFirstByUser(user);
        if (!pet) { await ctx.reply(t('photoNoPets', lang)); return; }

        const todayEvents = await this.petEventsService.getTodayEventsForUser(user);
        const lastEvent = todayEvents.at(-1);
        if (!lastEvent) {
            await ctx.reply(t('photoNoRecentEvents', lang));
            return;
        }

        const count = await this.petEventsService.countImages(lastEvent.id);
        if (count >= 10) {
            await ctx.reply(t('photoMaxReached', lang));
            return;
        }

        await this.petEventsService.addImage(lastEvent, buffer, mime);
        await ctx.reply(t('photoAttached', lang, { type: lastEvent.type }));
    }
}
