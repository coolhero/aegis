import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Queue } from 'bullmq';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { RequestLog } from './entities/request-log.entity';
import { LangfuseService } from './langfuse.service';
import { REQUEST_LOG_QUEUE } from './logging.constants';

export interface LogJobData {
  requestId: string;
  traceId: string;
  orgId: string;
  userId: string;
  teamId: string | null;
  model: string;
  provider: string;
  inputMasked: string | null;
  outputMasked: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: string;
  errorDetail: string | null;
  cacheHit: boolean;
  estimated: boolean;
  inputSize: number | null;
  outputSize: number | null;
}

@Injectable()
export class LoggingQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(LoggingQueueProcessor.name);
  queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
    @InjectRepository(RequestLog)
    private readonly requestLogRepo: Repository<RequestLog>,
    private readonly langfuseService: LangfuseService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.redis.options?.host ?? 'localhost',
      port: this.redis.options?.port ?? 6379,
    };

    this.queue = new Queue(REQUEST_LOG_QUEUE, { connection });

    this.worker = new Worker(
      REQUEST_LOG_QUEUE,
      async (job) => this.process(job.data),
      {
        connection,
        concurrency: 5,
        limiter: { max: 100, duration: 1000 },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Log job failed: ${job?.id} — ${err.message}`);
    });

    this.logger.log('LoggingQueueProcessor initialized');
  }

  async process(data: LogJobData): Promise<void> {
    try {
      // Check idempotency — skip if request_id already logged
      const existing = await this.requestLogRepo.findOne({
        where: { requestId: data.requestId },
      });
      if (existing) {
        this.logger.debug(`Duplicate log skipped: ${data.requestId}`);
        return;
      }

      // Send to Langfuse (fire-and-forget)
      let langfuseTraceId: string | null = null;
      if (this.langfuseService.isEnabled()) {
        langfuseTraceId = this.langfuseService.createTraceAndGeneration(
          {
            name: 'llm-request',
            metadata: { orgId: data.orgId, teamId: data.teamId },
            userId: data.userId,
          },
          {
            name: 'chat-completion',
            model: data.model,
            input: data.inputMasked,
            output: data.outputMasked,
            usage: {
              input: data.inputTokens,
              output: data.outputTokens,
              total: data.inputTokens + data.outputTokens,
            },
            metadata: { provider: data.provider, status: data.status },
          },
        );
      }

      // Save to DB
      await this.requestLogRepo.save(
        this.requestLogRepo.create({
          requestId: data.requestId,
          traceId: data.traceId,
          orgId: data.orgId,
          userId: data.userId,
          teamId: data.teamId,
          model: data.model,
          provider: data.provider,
          inputMasked: data.inputMasked,
          outputMasked: data.outputMasked,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          costUsd: data.costUsd,
          latencyMs: data.latencyMs,
          status: data.status,
          errorDetail: data.errorDetail,
          cacheHit: data.cacheHit,
          estimated: data.estimated,
          langfuseTraceId,
          inputSize: data.inputSize,
          outputSize: data.outputSize,
        }),
      );

      this.logger.debug(`Logged request ${data.requestId} (${data.model})`);
    } catch (error: any) {
      this.logger.error(
        `Failed to process log job ${data.requestId}: ${error.message}`,
      );
      throw error;
    }
  }
}
