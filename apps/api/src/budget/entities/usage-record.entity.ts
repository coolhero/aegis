import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Budget } from './budget.entity';
import { BudgetPeriod } from './budget-period.entity';

export enum UsageRecordStatus {
  RESERVED = 'reserved',
  RECONCILED = 'reconciled',
  RELEASED = 'released',
}

@Entity('usage_records')
export class UsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId!: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget!: Budget;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId!: string;

  @ManyToOne(() => BudgetPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id' })
  period!: BudgetPeriod;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  idempotencyKey!: string | null;

  @Column({ name: 'model_id', type: 'varchar', length: 255 })
  modelId!: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ name: 'estimated_tokens', type: 'int', default: 0 })
  estimatedTokens!: number;

  @Column({
    name: 'cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
    default: 0,
  })
  costUsd!: number;

  @Column({
    type: 'enum',
    enum: UsageRecordStatus,
    default: UsageRecordStatus.RESERVED,
  })
  status!: UsageRecordStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'reconciled_at', type: 'timestamp', nullable: true })
  reconciledAt!: Date | null;
}
