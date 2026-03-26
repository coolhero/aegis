import { SecurityPolicy } from '../entities/security-policy.entity';

export type ScannerType = 'pii' | 'injection' | 'content';

export interface ScanResult {
  decision: 'pass' | 'block' | 'mask';
  transformed?: string;
  details: Record<string, any>;
  latencyMs: number;
}

export interface Scanner {
  readonly type: ScannerType;
  scan(input: string, policy: SecurityPolicy): ScanResult;
}
