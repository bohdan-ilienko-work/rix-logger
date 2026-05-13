import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface TelegramUserContactInput {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    lang?: string;
}

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    async findByTelegramId(telegramId: string): Promise<User | null> {
        const user = await this.usersRepository.findOne({ where: { telegramId } });
        this.logger.debug(`findByTelegramId tg=${telegramId} found=${!!user}`);
        return user;
    }

    async createOrUpdateFromTelegramContact(
        payload: TelegramUserContactInput,
    ): Promise<User> {
        const existingUser = await this.findByTelegramId(payload.telegramId);

        if (existingUser) {
            existingUser.username = payload.username ?? existingUser.username;
            existingUser.firstName = payload.firstName ?? existingUser.firstName;
            existingUser.lastName = payload.lastName ?? existingUser.lastName;
            existingUser.phoneNumber = payload.phoneNumber ?? existingUser.phoneNumber;
            if (payload.lang) existingUser.lang = payload.lang;
            const saved = await this.usersRepository.save(existingUser);
            this.logger.log(`Updated user tg=${payload.telegramId} id=${saved.id}`);
            return saved;
        }

        const user = this.usersRepository.create({
            telegramId: payload.telegramId,
            username: payload.username ?? null,
            firstName: payload.firstName ?? null,
            lastName: payload.lastName ?? null,
            phoneNumber: payload.phoneNumber ?? null,
            lang: payload.lang ?? 'uk',
        });

        const saved = await this.usersRepository.save(user);
        this.logger.log(`Created user tg=${payload.telegramId} id=${saved.id}`);
        return saved;
    }

    async updateLang(telegramId: string, lang: string): Promise<User | null> {
        const user = await this.findByTelegramId(telegramId);
        if (!user) {
            this.logger.warn(`updateLang: user not found tg=${telegramId}`);
            return null;
        }
        user.lang = lang;
        const saved = await this.usersRepository.save(user);
        this.logger.log(`updateLang tg=${telegramId} lang=${lang}`);
        return saved;
    }
}
