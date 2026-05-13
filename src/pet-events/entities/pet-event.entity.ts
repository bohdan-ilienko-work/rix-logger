import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pet } from '../../pets/entities/pet.entity';
import { EventImage } from './event-image.entity';

export enum PetEventType {
    WALK = 'WALK',
    FOOD = 'FOOD',
    WEIGHT = 'WEIGHT',
    NOTE = 'NOTE',
}

export interface WalkEventValue {
    startTime: string;          // "HH:MM" — computed from endTime − duration
    endTime: string;            // "HH:MM" — when the walk ended
    durationMinutes: number;
    pooped: boolean;
    peed: boolean;
    note?: string | null;
}

export interface FoodEventValue {
    foodType: string;
    amount: string;
    appetite: 'good' | 'ok' | 'bad';
    note?: string | null;
}

export interface WeightEventValue {
    kg: number;
}

export interface NoteEventValue {
    text: string;
}

export type PetEventValue = WalkEventValue | FoodEventValue | WeightEventValue | NoteEventValue;

@Entity({ name: 'pet_events' })
export class PetEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.petEvents, { onDelete: 'CASCADE' })
    owner: User;

    @ManyToOne(() => Pet, (pet) => pet.petEvents, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    pet: Pet | null;

    @Column({
        type: 'enum',
        enum: PetEventType,
    })
    type: PetEventType;

    @Column({ type: 'jsonb', nullable: true })
    value: PetEventValue | null;

    @OneToMany(() => EventImage, (img) => img.event)
    images: EventImage[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
