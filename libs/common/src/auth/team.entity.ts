import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('teams')
@Unique(['orgId', 'slug'])
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id' })
  orgId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50 })
  slug!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
