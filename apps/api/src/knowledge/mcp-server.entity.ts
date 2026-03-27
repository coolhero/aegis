import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '@aegis/common';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

@Entity('mcp_server')
export class McpServer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orgId!: string;

  @Column()
  name!: string;

  @Column()
  url!: string;

  @Column({ default: '2024-11-05' })
  protocolVersion!: string;

  @Column({ type: 'jsonb', default: [] })
  tools!: McpTool[];

  @Column({ default: true })
  enabled!: boolean;

  @Column({ default: 'unknown' })
  healthStatus!: string; // healthy | unhealthy | unknown

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;
}
