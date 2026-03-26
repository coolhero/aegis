import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('request_logs')
@Index('IDX_request_logs_org_created', ['orgId', 'createdAt'])
@Index('IDX_request_logs_model', ['model'])
@Index('IDX_request_logs_user', ['userId'])
@Index('IDX_request_logs_status', ['status'])
export class RequestLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'request_id', type: 'uuid', unique: true })
  requestId!: string;

  @Column({ name: 'trace_id', length: 64 })
  traceId!: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId!: string | null;

  @Column({ length: 100 })
  model!: string;

  @Column({ length: 50 })
  provider!: string;

  @Column({ name: 'input_masked', type: 'text', nullable: true })
  inputMasked!: string | null;

  @Column({ name: 'output_masked', type: 'text', nullable: true })
  outputMasked!: string | null;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens!: number;

  @Column({
    name: 'cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
    default: 0,
  })
  costUsd!: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs!: number;

  @Column({ length: 20 })
  status!: string;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail!: string | null;

  @Column({ name: 'cache_hit', default: false })
  cacheHit!: boolean;

  @Column({ default: false })
  estimated!: boolean;

  @Column({ name: 'langfuse_trace_id', type: 'varchar', length: 100, nullable: true })
  langfuseTraceId!: string | null;

  @Column({ name: 'input_size', type: 'int', nullable: true })
  inputSize!: number | null;

  @Column({ name: 'output_size', type: 'int', nullable: true })
  outputSize!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
