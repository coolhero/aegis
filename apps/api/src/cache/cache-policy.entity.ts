import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cache_policy')
export class CachePolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id', unique: true })
  orgId!: string;

  @Column({
    name: 'similarity_threshold',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.95,
  })
  similarityThreshold!: number;

  @Column({ name: 'ttl_seconds', default: 86400 })
  ttlSeconds!: number;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
