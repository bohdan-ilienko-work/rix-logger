import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { PetMember } from './entities/pet-member.entity';
import { PetInvite } from './entities/pet-invite.entity';
import { PetsService } from './pets.service';

@Module({
    imports: [TypeOrmModule.forFeature([Pet, PetMember, PetInvite])],
    providers: [PetsService],
    exports: [PetsService, TypeOrmModule],
})
export class PetsModule { }
