import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

@Entity('prompt_usage_stat')
@Unique(['templateId'])
export class PromptUsageStat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  templateId!: string;

  @Column({ type: 'int', default: 0 })
  callCount!: number;

  @Column({ type: 'bigint', default: 0 })
  totalTokens!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @ManyToOne('PromptTemplate', 'usageStat', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: any;
}
