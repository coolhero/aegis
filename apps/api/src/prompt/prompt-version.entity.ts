import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

@Entity('prompt_version')
@Unique(['templateId', 'versionNumber'])
export class PromptVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  templateId!: string;

  @Column({ type: 'int' })
  versionNumber!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ length: 500, nullable: true })
  changeNote!: string | null;

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne('PromptTemplate', 'versions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: any;
}
