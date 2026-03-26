import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ScannerType = 'pii' | 'injection' | 'content';
export type GuardDecision = 'pass' | 'block' | 'mask' | 'bypass';

@Entity('guard_results')
@Index('IDX_guard_results_request', ['requestId'])
@Index('IDX_guard_results_scanner_decision', ['scannerType', 'decision'])
@Index('IDX_guard_results_created', ['createdAt'])
export class GuardResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 100 })
  requestId!: string;

  @Column({ name: 'scanner_type', type: 'varchar', length: 20 })
  scannerType!: ScannerType;

  @Column({ type: 'varchar', length: 10 })
  decision!: GuardDecision;

  @Column({ type: 'jsonb', default: '{}' })
  details!: Record<string, any>;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
