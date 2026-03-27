import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organization } from '@aegis/common';

@Entity('document')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orgId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: 'text/markdown' })
  contentType!: string;

  @Column({ default: 0 })
  chunkCount!: number;

  @Column({ default: 'pending' })
  embeddingStatus!: string; // pending | processing | done | failed

  @Column({ type: 'text', nullable: true })
  errorDetail!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @OneToMany('Embedding', 'document')
  embeddings!: any[];
}
