import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface TelegramInitUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
}

@Injectable()
export class TelegramInitDataGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            telegramUser?: TelegramInitUser;
        }>();

        const initData = (req.headers['x-init-data'] as string | undefined) ?? '';
        const nodeEnv = (this.configService.get<string>('NODE_ENV') ?? '').toLowerCase();
        const isProduction = nodeEnv === 'production';

        // Dev bypass: if no initData and MINIAPP_DEV_USER_ID is set, use a mock user
        if (!initData) {
            const devUserId = this.configService.get<string>('miniapp.devUserId');
            if (!isProduction && devUserId) {
                req.telegramUser = { id: Number(devUserId), first_name: 'Dev' };
                return true;
            }
            return false;
        }

        const botToken = this.configService.get<string>('bot.token') ?? '';
        const valid = this.validateInitData(initData, botToken);
        if (!valid) return false;

        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (userStr) {
            try {
                req.telegramUser = JSON.parse(userStr) as TelegramInitUser;
            } catch {
                return false;
            }
        }

        return true;
    }

    private validateInitData(initData: string, botToken: string): boolean {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return false;

        params.delete('hash');

        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

        const calculated = createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return calculated === hash;
    }
}
