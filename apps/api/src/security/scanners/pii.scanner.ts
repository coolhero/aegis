import { Injectable } from '@nestjs/common';
import { Scanner, ScanResult } from './scanner.interface';
import { SecurityPolicy, CustomPiiPattern } from '../entities/security-policy.entity';

interface PiiPattern {
  name: string;
  regex: RegExp;
  placeholder: string;
}

const BUILT_IN_PATTERNS: PiiPattern[] = [
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    placeholder: '[EMAIL]',
  },
  {
    // SSN must come before phone to avoid partial matching (6+7 digits vs phone pattern)
    name: 'ssn',
    regex: /\d{6}[-\s]\d{7}/g,
    placeholder: '[SSN]',
  },
  {
    name: 'phone',
    regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    placeholder: '[PHONE]',
  },
];

@Injectable()
export class PiiScanner implements Scanner {
  readonly type = 'pii' as const;

  scan(input: string, policy: SecurityPolicy): ScanResult {
    const start = Date.now();
    const activeCategories = policy.piiCategories || [];

    if (activeCategories.length === 0) {
      return {
        decision: 'pass',
        details: { scanned: false, reason: 'no_pii_categories' },
        latencyMs: Date.now() - start,
      };
    }

    const patterns = this.getActivePatterns(activeCategories, policy.customPiiPatterns || []);
    const detected: string[] = [];
    let transformed = input;

    for (const pattern of patterns) {
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(transformed)) {
        detected.push(pattern.name);
        pattern.regex.lastIndex = 0;
        transformed = transformed.replace(pattern.regex, pattern.placeholder);
      }
    }

    if (detected.length === 0) {
      return {
        decision: 'pass',
        details: { scanned: true, detected: [] },
        latencyMs: Date.now() - start,
      };
    }

    const action = policy.piiAction || 'mask';

    if (action === 'reject') {
      return {
        decision: 'block',
        details: { detected, action: 'reject' },
        latencyMs: Date.now() - start,
      };
    }

    if (action === 'warn') {
      return {
        decision: 'pass',
        transformed: input, // Keep original for warn
        details: { detected, action: 'warn', warning: true },
        latencyMs: Date.now() - start,
      };
    }

    // action === 'mask'
    return {
      decision: 'mask',
      transformed,
      details: { detected, maskedCount: detected.length },
      latencyMs: Date.now() - start,
    };
  }

  private getActivePatterns(
    categories: string[],
    customPatterns: CustomPiiPattern[],
  ): PiiPattern[] {
    const patterns: PiiPattern[] = [];
    const categorySet = new Set(categories);

    // Add built-in patterns in their defined order (e.g., SSN before phone)
    for (const builtIn of BUILT_IN_PATTERNS) {
      if (categorySet.has(builtIn.name)) {
        patterns.push({
          ...builtIn,
          regex: new RegExp(builtIn.regex.source, builtIn.regex.flags),
        });
      }
    }

    // Add custom patterns
    for (const custom of customPatterns) {
      if (categorySet.has(custom.name)) {
        try {
          patterns.push({
            name: custom.name,
            regex: new RegExp(custom.pattern, 'g'),
            placeholder: custom.placeholder,
          });
        } catch {
          // Invalid regex — skip
        }
      }
    }

    return patterns;
  }
}
