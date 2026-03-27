import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('cache_entry')
@Index('idx_cache_entry_org_model', ['orgId', 'model'])
@Index('idx_cache_entry_hash', ['orgId', 'model', 'queryHash'])
export class CacheEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id' })
  orgId!: string;

  @Column()
  model!: string;

  @Column({ name: 'query_hash' })
  queryHash!: string;

  @Column({ name: 'query_vector', type: 'float8', array: true })
  queryVector!: number[];

  @Column({ type: 'jsonb' })
  response!: Record<string, any>;

  @Column({ name: 'tokens_saved', default: 0 })
  tokensSaved!: number;

  @Column({ name: 'hit_count', default: 0 })
  hitCount!: number;

  @Column()
  ttl!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  @Index('idx_cache_entry_expires')
  expiresAt!: Date;
}
