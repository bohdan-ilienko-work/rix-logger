import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : '*',
  });

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);

  Logger.log(`Server is running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
