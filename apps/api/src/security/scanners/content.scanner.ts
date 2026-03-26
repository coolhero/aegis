import { Injectable } from '@nestjs/common';
import { Scanner, ScanResult } from './scanner.interface';
import { SecurityPolicy } from '../entities/security-policy.entity';

const CONTENT_PATTERNS: Record<string, RegExp[]> = {
  hate_speech: [
    /\b(racial\s+slur|ethnic\s+cleansing|supremac(y|ist))\b/i,
  ],
  violence: [
    /\b(how\s+to\s+(kill|murder|harm|attack|assassinate))\b/i,
    /\b(instructions?\s+(for|to)\s+(making|build)\s+(a\s+)?(bomb|weapon|explosive))\b/i,
  ],
  self_harm: [
    /\b(how\s+to\s+(commit\s+)?suicide)\b/i,
    /\b(methods?\s+(of|for)\s+self[- ]harm)\b/i,
  ],
  illegal: [
    /\b(how\s+to\s+(hack|crack|steal|counterfeit|forge))\b/i,
    /\b(instructions?\s+(for|to)\s+(making|synthesiz)\s+(drugs?|meth|fentanyl))\b/i,
  ],
};

@Injectable()
export class ContentScanner implements Scanner {
  readonly type = 'content' as const;

  scan(input: string, policy: SecurityPolicy): ScanResult {
    const start = Date.now();
    const activeCategories = policy.contentFilterCategories || [];

    if (activeCategories.length === 0) {
      return {
        decision: 'pass',
        details: { scanned: false, reason: 'no_content_categories' },
        latencyMs: Date.now() - start,
      };
    }

    for (const category of activeCategories) {
      const patterns = CONTENT_PATTERNS[category];
      if (!patterns) continue;

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            decision: 'block',
            details: {
              category,
              severity: 'high',
            },
            latencyMs: Date.now() - start,
          };
        }
      }
    }

    return {
      decision: 'pass',
      details: { scanned: true, categoriesChecked: activeCategories.length },
      latencyMs: Date.now() - start,
    };
  }
}
