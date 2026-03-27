import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '@aegis/common';

@Entity('prompt_template')
export class PromptTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orgId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  variables!: Array<{ name: string; required: boolean; default_value: string | null }>;

  @Column({ type: 'uuid', nullable: true })
  activeVersionId!: string | null;

  @Column({ length: 20, default: 'draft' })
  status!: string; // draft | published | archived

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @OneToMany('PromptVersion', 'template')
  versions!: any[];

  @OneToMany('AbTest', 'template')
  abTests!: any[];

  @OneToOne('PromptUsageStat', 'template')
  usageStat!: any;
}
