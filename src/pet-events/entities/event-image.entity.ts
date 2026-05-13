import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { PetEvent } from './pet-event.entity';

@Entity({ name: 'event_images' })
export class EventImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => PetEvent, (event) => event.images, { onDelete: 'CASCADE' })
    event: PetEvent;

    @Column({ type: 'bytea' })
    data: Buffer;

    @Column({ type: 'varchar' })
    mime: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
