import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('ab_test_variant')
export class AbTestVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  abTestId!: string;

  @Column('uuid')
  versionId!: string;

  @Column({ type: 'int' })
  weight!: number;

  @Column({ type: 'int', default: 0 })
  callCount!: number;

  @Column({ type: 'bigint', default: 0 })
  totalTokens!: number;

  @ManyToOne('AbTest', 'variants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ab_test_id' })
  abTest!: any;

  @ManyToOne('PromptVersion', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version!: any;
}
