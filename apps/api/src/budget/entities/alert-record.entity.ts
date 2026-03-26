import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Budget } from './budget.entity';
import { BudgetPeriod } from './budget-period.entity';

@Entity('alert_records')
@Unique(['budgetId', 'periodId', 'threshold'])
export class AlertRecord {
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

  @Column({ type: 'int' })
  threshold!: number;

  @Column({ name: 'usage_pct', type: 'decimal', precision: 5, scale: 2 })
  usagePct!: number;

  @Column({ name: 'webhook_status', length: 20, default: 'pending' })
  webhookStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
