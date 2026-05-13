import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction): void {
        const start = Date.now();
        const { method, originalUrl } = req;

        res.on('finish', () => {
            const ms = Date.now() - start;
            const status = res.statusCode;
            const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log';

            const msg = `${method} ${originalUrl} ${status} ${ms}ms`;
            this.logger[level](msg);
        });

        next();
    }
}
