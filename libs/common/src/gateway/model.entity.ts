import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Provider } from './provider.entity';

@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  providerId!: string;

  @ManyToOne(() => Provider)
  @JoinColumn({ name: 'providerId' })
  provider!: Provider;

  @Column({ unique: true })
  name!: string;

  @Column()
  displayName!: string;

  @Column({ type: 'decimal', precision: 20, scale: 12, default: 0 })
  inputPricePerToken!: number;

  @Column({ type: 'decimal', precision: 20, scale: 12, default: 0 })
  outputPricePerToken!: number;

  @Column({ type: 'int', default: 4096 })
  maxTokens!: number;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
