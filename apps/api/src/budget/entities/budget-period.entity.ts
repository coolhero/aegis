import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Budget } from './budget.entity';

@Entity('budget_periods')
export class BudgetPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId!: string;

  @ManyToOne(() => Budget, (budget) => budget.periods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget!: Budget;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate!: Date;

  @Column({ name: 'total_tokens_used', type: 'bigint', default: 0 })
  totalTokensUsed!: number;

  @Column({
    name: 'total_cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0,
  })
  totalCostUsd!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
