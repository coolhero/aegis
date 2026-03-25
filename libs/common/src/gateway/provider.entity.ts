import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'enum', enum: ProviderType })
  type!: ProviderType;

  @Column({ nullable: true })
  apiKeyEncrypted!: string;

  @Column({ nullable: true })
  baseUrl!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ default: 'unknown' })
  healthStatus!: string;

  @Column({ type: 'int', default: 1 })
  weight!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
