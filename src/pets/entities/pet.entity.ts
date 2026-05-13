import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PetEvent } from '../../pet-events/entities/pet-event.entity';
import { PetMember } from './pet-member.entity';

@Entity({ name: 'pets' })
export class Pet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Legacy owner relation kept for backward compatibility with existing rows.
    @ManyToOne(() => User, (user) => user.pets, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    owner: User;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'varchar', nullable: true })
    age: string | null;

    @Column({ type: 'varchar', nullable: true })
    breed: string | null;

    @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
    weightKg: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'bytea', nullable: true, select: false })
    avatar: Buffer | null;

    @Column({ type: 'varchar', nullable: true })
    avatarMime: string | null;

    @OneToMany(() => PetEvent, (event) => event.pet)
    petEvents: PetEvent[];

    @OneToMany(() => PetMember, (membership) => membership.pet)
    memberships: PetMember[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
