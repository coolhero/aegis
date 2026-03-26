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
import { Organization } from '@aegis/common/auth/organization.entity';
import { BudgetPeriod } from './budget-period.entity';

export enum BudgetLevel {
  ORG = 'org',
  TEAM = 'team',
  USER = 'user',
}

@Entity('budgets')
@Unique(['level', 'targetId', 'modelTierId'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: BudgetLevel })
  level!: BudgetLevel;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId!: string;

  @Column({ name: 'model_tier_id', type: 'uuid', nullable: true })
  modelTierId!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ name: 'token_limit', type: 'bigint' })
  tokenLimit!: number;

  @Column({
    name: 'cost_limit_usd',
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  costLimitUsd!: number;

  @Column({
    name: 'alert_thresholds',
    type: 'jsonb',
    default: '[80, 90, 100]',
  })
  alertThresholds!: number[];

  @Column({ name: 'period_type', length: 20, default: 'monthly' })
  periodType!: string;

  @Column({ name: 'webhook_url', type: 'varchar', length: 500, nullable: true })
  webhookUrl!: string | null;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ name: 'current_period_id', type: 'uuid', nullable: true })
  currentPeriodId!: string | null;

  @OneToMany(() => BudgetPeriod, (period) => period.budget)
  periods!: BudgetPeriod[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
