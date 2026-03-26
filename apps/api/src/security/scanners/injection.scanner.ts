import { Injectable } from '@nestjs/common';
import { Scanner, ScanResult } from './scanner.interface';
import { SecurityPolicy } from '../entities/security-policy.entity';

// Known prompt injection patterns (case-insensitive)
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?(above|previous|prior)/i,
  /forget\s+(all\s+)?(above|previous|prior|your)\s+(instructions|rules|guidelines)/i,
  /reveal\s+(the\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(the\s+)?(system\s+)?prompt/i,
  /what\s+(are|is)\s+(your|the)\s+(system\s+)?(instructions|prompt|rules)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+(if\s+you\s+(are|were)|a|an)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /new\s+instructions?\s*:/i,
  /override\s+(previous\s+)?(instructions|rules|guidelines)/i,
  /do\s+not\s+follow\s+(your|the)\s+(previous\s+)?(instructions|rules)/i,
  /bypass\s+(all\s+)?(safety|security|content)\s+(filters?|restrictions?|guidelines?)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
];

// Allowlist — patterns that look like injection but are benign
const ALLOWLIST_PATTERNS: RegExp[] = [
  /ignore\s+the\s+noise/i,
  /ignore\s+(this|that|those)\s+(data|value|error|warning|field)/i,
  /disregard\s+(this|that|the)\s+(error|warning|noise|outlier)/i,
  /forget\s+(about\s+)?(this|that|it)/i,
  /act\s+as\s+a\s+(filter|proxy|gateway|bridge|middleware)/i,
];

@Injectable()
export class InjectionScanner implements Scanner {
  readonly type = 'injection' as const;

  scan(input: string, policy: SecurityPolicy): ScanResult {
    const start = Date.now();

    if (!policy.injectionDefenseEnabled) {
      return {
        decision: 'pass',
        details: { scanned: false, reason: 'injection_defense_disabled' },
        latencyMs: Date.now() - start,
      };
    }

    // Check allowlist first
    for (const allowPattern of ALLOWLIST_PATTERNS) {
      if (allowPattern.test(input)) {
        return {
          decision: 'pass',
          details: { scanned: true, allowlisted: true },
          latencyMs: Date.now() - start,
        };
      }
    }

    // Check injection patterns
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          decision: 'block',
          details: {
            pattern: pattern.source,
            confidence: 0.95,
          },
          latencyMs: Date.now() - start,
        };
      }
    }

    return {
      decision: 'pass',
      details: { scanned: true },
      latencyMs: Date.now() - start,
    };
  }
}
