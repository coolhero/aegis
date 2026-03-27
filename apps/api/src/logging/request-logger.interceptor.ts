import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Model } from '@aegis/common/gateway/model.entity';
import { MAX_CONTENT_SIZE, MAX_FALLBACK_BUFFER_SIZE } from './logging.constants';
import { LogJobData, LoggingQueueProcessor } from './logging-queue.processor';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggerInterceptor.name);
  private fallbackBuffer: LogJobData[] = [];
  private queueAvailable = true;

  constructor(
    private readonly queueProcessor: LoggingQueueProcessor,
    @InjectRepository(Model)
    private readonly modelRepo: Repository<Model>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startedAt = Date.now();

    // Extract tenant context from API key auth
    const apiKey = request.apiKey;
    if (!apiKey) return next.handle(); // Internal request — no logging

    const orgId = apiKey.orgId;
    const userId = apiKey.userId;
    const teamId = apiKey.teamId ?? null;
    const body = request.body;
    const modelName = body?.model ?? 'unknown';
    const requestId = request.id ?? randomUUID();

    // Extract trace_id from OpenTelemetry or generate UUID
    let traceId: string;
    try {
      const otel = require('@opentelemetry/api');
      const span = otel.trace.getActiveSpan();
      traceId = span?.spanContext()?.traceId ?? randomUUID();
    } catch {
      traceId = randomUUID();
    }

    // Extract input content (truncated)
    const inputContent = this.extractInput(body?.messages);
    const inputSize = inputContent ? Buffer.byteLength(inputContent, 'utf-8') : null;
    const inputMasked = this.truncateContent(inputContent);

    // Determine provider from model name
    const providerName = this.resolveProvider(modelName);

    return next.handle().pipe(
      tap(async (response) => {
        const latencyMs = Date.now() - startedAt;
        const usage = response?.usage;

        const inputTokens = usage?.prompt_tokens ?? 0;
        const outputTokens = usage?.completion_tokens ?? 0;
        const estimated = !usage;

        // Extract output content (truncated)
        const outputContent = this.extractOutput(response);
        const outputSize = outputContent ? Buffer.byteLength(outputContent, 'utf-8') : null;
        const outputMasked = this.truncateContent(outputContent);

        // Calculate cost
        const costUsd = await this.calculateCost(
          modelName,
          inputTokens,
          outputTokens,
        );

        await this.enqueueLog({
          requestId,
          traceId,
          orgId,
          userId,
          teamId,
          model: modelName,
          provider: providerName,
          inputMasked,
          outputMasked,
          inputTokens,
          outputTokens,
          costUsd,
          latencyMs,
          status: 'success',
          errorDetail: null,
          cacheHit: request.cacheHit === true,
          estimated,
          inputSize,
          outputSize,
        });
      }),
      catchError((error) => {
        const latencyMs = Date.now() - startedAt;

        // Still log the error request
        this.enqueueLog({
          requestId,
          traceId,
          orgId,
          userId,
          teamId,
          model: modelName,
          provider: providerName,
          inputMasked,
          outputMasked: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs,
          status: 'error',
          errorDetail: error?.message ?? String(error),
          cacheHit: false,
          estimated: true,
          inputSize,
          outputSize: null,
        }).catch(() => {
          // Fire-and-forget — don't affect error propagation
        });

        return throwError(() => error);
      }),
    );
  }

  private async enqueueLog(data: LogJobData): Promise<void> {
    try {
      if (this.queueAvailable && this.queueProcessor.queue) {
        await this.queueProcessor.queue.add('log', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false, // Keep in DLQ for inspection
        });
      } else {
        this.bufferLog(data);
      }
    } catch {
      this.bufferLog(data);
    }
  }

  private bufferLog(data: LogJobData): void {
    if (this.fallbackBuffer.length < MAX_FALLBACK_BUFFER_SIZE) {
      this.fallbackBuffer.push(data);
    } else {
      this.logger.error('Fallback buffer full — dropping log entry');
    }
  }

  async flushBuffer(): Promise<void> {
    if (this.fallbackBuffer.length === 0) return;

    this.logger.log(`Flushing ${this.fallbackBuffer.length} buffered logs`);
    const entries = [...this.fallbackBuffer];
    this.fallbackBuffer = [];

    for (const data of entries) {
      try {
        await this.queueProcessor.queue.add('log', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      } catch {
        this.fallbackBuffer.push(data);
      }
    }

    this.queueAvailable = true;
  }

  private extractInput(messages: any[] | undefined): string | null {
    if (!messages || messages.length === 0) return null;
    return JSON.stringify(messages);
  }

  private extractOutput(response: any): string | null {
    if (!response?.choices?.[0]?.message?.content) return null;
    return response.choices[0].message.content;
  }

  private truncateContent(content: string | null): string | null {
    if (!content) return null;
    const bytes = Buffer.byteLength(content, 'utf-8');
    if (bytes <= MAX_CONTENT_SIZE) return content;
    // Truncate to MAX_CONTENT_SIZE bytes
    const buf = Buffer.from(content, 'utf-8');
    return buf.subarray(0, MAX_CONTENT_SIZE).toString('utf-8');
  }

  private resolveProvider(modelName: string): string {
    if (modelName.startsWith('gpt-') || modelName.startsWith('o1') || modelName.startsWith('o3')) {
      return 'openai';
    }
    if (modelName.startsWith('claude-')) {
      return 'anthropic';
    }
    return 'unknown';
  }

  private async calculateCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<number> {
    try {
      const model = await this.modelRepo.findOne({
        where: { name: modelName },
      });
      if (!model) return 0;
      return (
        Number(model.inputPricePerToken) * inputTokens +
        Number(model.outputPricePerToken) * outputTokens
      );
    } catch {
      return 0;
    }
  }
}
