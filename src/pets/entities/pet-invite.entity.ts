import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Pet } from './pet.entity';
import { PetMemberRole } from './pet-member.entity';

@Entity({ name: 'pet_invites' })
export class PetInvite {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
    pet!: Pet;

    @Column({ type: 'enum', enum: PetMemberRole, default: PetMemberRole.CAREGIVER })
    role!: PetMemberRole;

    @Column({ type: 'varchar', nullable: true })
    tag!: string | null;

    @Column({ type: 'bigint', nullable: true })
    expiresAt!: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
