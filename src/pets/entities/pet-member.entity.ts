import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pet } from './pet.entity';

export enum PetMemberRole {
    OWNER = 'OWNER',
    CAREGIVER = 'CAREGIVER',
    OBSERVER = 'OBSERVER',
    TRAINER = 'TRAINER',
    VET = 'VET',
}

@Entity({ name: 'pet_members' })
@Unique('UQ_pet_member_pet_user', ['pet', 'user'])
export class PetMember {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Pet, (pet) => pet.memberships, { onDelete: 'CASCADE' })
    pet!: Pet;

    @ManyToOne(() => User, (user) => user.petMemberships, { onDelete: 'CASCADE' })
    user!: User;

    @Column({
        type: 'enum',
        enum: PetMemberRole,
        default: PetMemberRole.CAREGIVER,
    })
    role!: PetMemberRole;

    @Column({ type: 'varchar', nullable: true })
    tag!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
