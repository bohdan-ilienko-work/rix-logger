import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { PetMember } from '../../pets/entities/pet-member.entity';
import { PetEvent } from '../../pet-events/entities/pet-event.entity';

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', unique: true })
    telegramId!: string;

    @Column({ type: 'varchar', nullable: true })
    username!: string | null;

    @Column({ type: 'varchar', nullable: true })
    firstName!: string | null;

    @Column({ type: 'varchar', nullable: true })
    lastName!: string | null;

    @Column({ type: 'varchar', nullable: true })
    phoneNumber!: string | null;

    @Column({ type: 'varchar', length: 10, default: 'uk' })
    lang!: string;

    @OneToMany(() => Pet, (pet) => pet.owner)
    pets!: Pet[];

    @OneToMany(() => PetMember, (membership) => membership.user)
    petMemberships!: PetMember[];

    @OneToMany(() => PetEvent, (event) => event.owner)
    petEvents!: PetEvent[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
