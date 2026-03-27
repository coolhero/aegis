import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('ab_test')
export class AbTest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  templateId!: string;

  @Column({ length: 20, default: 'active' })
  status!: string; // active | completed

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt!: Date | null;

  @ManyToOne('PromptTemplate', 'abTests', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: any;

  @OneToMany('AbTestVariant', 'abTest')
  variants!: any[];
}
