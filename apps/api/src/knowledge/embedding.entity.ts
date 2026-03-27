import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('embedding')
export class Embedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  documentId!: string;

  @Column()
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string; // original chunk text

  // pgvector vector(1536) column — managed via raw SQL, NOT TypeORM sync
  // Column exists in DB but excluded from TypeORM to prevent type conflict
  vector?: number[];

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;
}
