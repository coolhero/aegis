import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Organization } from '@aegis/common';

@Entity('model_tiers')
@Unique(['orgId', 'name'])
export class ModelTier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => ModelTierMember, (member) => member.tier)
  members!: ModelTierMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('model_tier_members')
@Unique(['modelId'])
export class ModelTierMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tier_id', type: 'uuid' })
  tierId!: string;

  @ManyToOne(() => ModelTier, (tier) => tier.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tier_id' })
  tier!: ModelTier;

  @Column({ name: 'model_id', type: 'uuid' })
  modelId!: string;
}
