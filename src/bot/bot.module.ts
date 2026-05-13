import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { PetsModule } from '../pets/pets.module';
import { PetEventsModule } from '../pet-events/pet-events.module';

@Module({
    imports: [UsersModule, PetsModule, PetEventsModule],
    providers: [BotService],
})
export class BotModule { }
