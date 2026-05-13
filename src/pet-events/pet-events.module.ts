import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PetEvent } from './entities/pet-event.entity';
import { EventImage } from './entities/event-image.entity';
import { PetEventsService } from './pet-events.service';

@Module({
    imports: [TypeOrmModule.forFeature([PetEvent, EventImage])],
    providers: [PetEventsService],
    exports: [PetEventsService, TypeOrmModule],
})
export class PetEventsModule { }
