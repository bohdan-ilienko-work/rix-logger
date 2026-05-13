import { Injectable } from '@nestjs/common';
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
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    async findByTelegramId(telegramId: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { telegramId } });
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
            return this.usersRepository.save(existingUser);
        }

        const user = this.usersRepository.create({
            telegramId: payload.telegramId,
            username: payload.username ?? null,
            firstName: payload.firstName ?? null,
            lastName: payload.lastName ?? null,
            phoneNumber: payload.phoneNumber ?? null,
            lang: payload.lang ?? 'uk',
        });

        return this.usersRepository.save(user);
    }

    async updateLang(telegramId: string, lang: string): Promise<User | null> {
        const user = await this.findByTelegramId(telegramId);
        if (!user) return null;
        user.lang = lang;
        return this.usersRepository.save(user);
    }
}
