import { Module } from '@nestjs/common';
import { PetEventsModule } from '../pet-events/pet-events.module';
import { PetsModule } from '../pets/pets.module';
import { UsersModule } from '../users/users.module';
import { MiniappController } from './miniapp.controller';
import { MiniappImagesController } from './miniapp-images.controller';
import { TelegramInitDataGuard } from './telegram-init-data.guard';

@Module({
    imports: [UsersModule, PetsModule, PetEventsModule],
    controllers: [MiniappController, MiniappImagesController],
    providers: [TelegramInitDataGuard],
})
export class MiniappModule { }
