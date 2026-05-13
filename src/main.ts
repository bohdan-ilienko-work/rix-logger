import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the mini app (any origin in dev, restrict in production)
  app.enableCors({ origin: '*' });

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);

  Logger.log(`Server is running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
