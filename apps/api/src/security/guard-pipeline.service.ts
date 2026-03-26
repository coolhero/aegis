import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuardResult } from './entities/guard-result.entity';
import { SecurityPolicy } from './entities/security-policy.entity';
import { InputNormalizer } from './scanners/normalizer';
import { PiiScanner } from './scanners/pii.scanner';
import { InjectionScanner } from './scanners/injection.scanner';
import { ContentScanner } from './scanners/content.scanner';
import { ScanResult } from './scanners/scanner.interface';

export interface GuardPipelineResult {
  allowed: boolean;
  transformedInput?: string;
  results: Array<{ scannerType: string; result: ScanResult }>;
  totalLatencyMs: number;
  bypassed: boolean;
}

@Injectable()
export class GuardPipelineService {
  private readonly logger = new Logger(GuardPipelineService.name);

  constructor(
    @InjectRepository(GuardResult)
    private readonly guardResultRepo: Repository<GuardResult>,
    private readonly normalizer: InputNormalizer,
    private readonly piiScanner: PiiScanner,
    private readonly injectionScanner: InjectionScanner,
    private readonly contentScanner: ContentScanner,
  ) {}

  async scanInput(
    input: string,
    policy: SecurityPolicy,
    requestId: string,
    bypass: boolean = false,
  ): Promise<GuardPipelineResult> {
    const start = Date.now();

    if (bypass) {
      await this.saveResult(requestId, 'pii', 'bypass', { bypassed: true }, 0);
      return {
        allowed: true,
        transformedInput: input,
        results: [],
        totalLatencyMs: Date.now() - start,
        bypassed: true,
      };
    }

    // Normalize input before scanning (FR-005)
    const normalizedInput = this.normalizer.normalize(input);
    const results: Array<{ scannerType: string; result: ScanResult }> = [];

    try {
      // 1. Injection scan (FR-001: injection → PII → content order)
      const injectionResult = this.injectionScanner.scan(normalizedInput, policy);
      results.push({ scannerType: 'injection', result: injectionResult });
      await this.saveResult(
        requestId,
        'injection',
        injectionResult.decision,
        injectionResult.details,
        injectionResult.latencyMs,
      );

      if (injectionResult.decision === 'block') {
        return {
          allowed: false,
          results,
          totalLatencyMs: Date.now() - start,
          bypassed: false,
        };
      }

      // 2. PII scan
      const piiResult = this.piiScanner.scan(normalizedInput, policy);
      results.push({ scannerType: 'pii', result: piiResult });
      await this.saveResult(
        requestId,
        'pii',
        piiResult.decision,
        piiResult.details,
        piiResult.latencyMs,
      );

      if (piiResult.decision === 'block') {
        return {
          allowed: false,
          results,
          totalLatencyMs: Date.now() - start,
          bypassed: false,
        };
      }

      // 3. Content scan
      const contentResult = this.contentScanner.scan(
        piiResult.transformed ?? normalizedInput,
        policy,
      );
      results.push({ scannerType: 'content', result: contentResult });
      await this.saveResult(
        requestId,
        'content',
        contentResult.decision,
        contentResult.details,
        contentResult.latencyMs,
      );

      if (contentResult.decision === 'block') {
        return {
          allowed: false,
          results,
          totalLatencyMs: Date.now() - start,
          bypassed: false,
        };
      }

      // All scanners passed
      const transformedInput = piiResult.transformed ?? normalizedInput;
      return {
        allowed: true,
        transformedInput,
        results,
        totalLatencyMs: Date.now() - start,
        bypassed: false,
      };
    } catch (error) {
      // Fail-closed (FR-015): scanner error → block request
      this.logger.error(
        `Guard pipeline error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        allowed: false,
        results,
        totalLatencyMs: Date.now() - start,
        bypassed: false,
      };
    }
  }

  async scanOutput(
    output: string,
    policy: SecurityPolicy,
    requestId: string,
  ): Promise<{ transformed: string; blocked: boolean }> {
    try {
      // PII scan on output
      const piiResult = this.piiScanner.scan(output, policy);
      await this.saveResult(
        requestId,
        'pii',
        piiResult.decision,
        { ...piiResult.details, direction: 'output' },
        piiResult.latencyMs,
      );

      const transformedOutput = piiResult.transformed ?? output;

      // Content scan on output
      const contentResult = this.contentScanner.scan(transformedOutput, policy);
      await this.saveResult(
        requestId,
        'content',
        contentResult.decision,
        { ...contentResult.details, direction: 'output' },
        contentResult.latencyMs,
      );

      if (contentResult.decision === 'block') {
        return { transformed: '[Content filtered by security policy]', blocked: true };
      }

      return { transformed: transformedOutput, blocked: false };
    } catch (error) {
      this.logger.error(
        `Output scan error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fail-closed on output scan errors too
      return { transformed: '[Content filtered due to scanner error]', blocked: true };
    }
  }

  private async saveResult(
    requestId: string,
    scannerType: string,
    decision: string,
    details: Record<string, any>,
    latencyMs: number,
  ): Promise<void> {
    try {
      const result = this.guardResultRepo.create({
        requestId,
        scannerType: scannerType as any,
        decision: decision as any,
        details,
        latencyMs,
      });
      await this.guardResultRepo.save(result);
    } catch (error) {
      // Fire-and-forget — don't let logging failure affect pipeline
      this.logger.error(
        `Failed to save guard result: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
