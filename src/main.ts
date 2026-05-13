import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : '*',
  });
  logger.log(`CORS origin: ${corsOrigin || '* (all)'}`);

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Server running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Database: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
  logger.log(`Bot token: ${process.env.BOT_TOKEN ? 'configured' : 'NOT SET'}`);
}
bootstrap();
