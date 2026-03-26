import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface CustomPiiPattern {
  name: string;
  pattern: string;
  placeholder: string;
}

@Entity('security_policies')
@Index('IDX_security_policies_org', ['orgId'], { unique: true })
export class SecurityPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id', type: 'uuid', unique: true })
  orgId!: string;

  @Column({
    name: 'pii_categories',
    type: 'jsonb',
    default: '["email","phone","ssn"]',
  })
  piiCategories!: string[];

  @Column({
    name: 'pii_action',
    type: 'varchar',
    length: 10,
    default: 'mask',
  })
  piiAction!: 'mask' | 'reject' | 'warn';

  @Column({
    name: 'injection_defense_enabled',
    type: 'boolean',
    default: true,
  })
  injectionDefenseEnabled!: boolean;

  @Column({
    name: 'content_filter_categories',
    type: 'jsonb',
    default: '["hate_speech","violence","self_harm","illegal"]',
  })
  contentFilterCategories!: string[];

  @Column({
    name: 'bypass_roles',
    type: 'jsonb',
    default: '[]',
  })
  bypassRoles!: string[];

  @Column({
    name: 'custom_pii_patterns',
    type: 'jsonb',
    default: '[]',
  })
  customPiiPatterns!: CustomPiiPattern[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
