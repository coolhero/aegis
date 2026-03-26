import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LangfuseTraceInput {
  name: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export interface LangfuseGenerationInput {
  name: string;
  model: string;
  input?: any;
  output?: any;
  usage?: { input: number; output: number; total: number };
  metadata?: Record<string, any>;
}

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);
  private client: any = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
    const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
    const baseUrl = this.configService.get<string>('LANGFUSE_BASE_URL');

    if (secretKey && publicKey) {
      try {
        // Dynamic import to avoid hard dependency
         
        const { Langfuse } = require('langfuse-node');
        this.client = new Langfuse({
          secretKey,
          publicKey,
          baseUrl: baseUrl || undefined,
        });
        this.enabled = true;
        this.logger.log('Langfuse initialized successfully');
      } catch (error: any) {
        this.logger.warn(`Langfuse initialization failed: ${error.message}`);
      }
    } else {
      this.logger.log('Langfuse not configured (missing keys) — disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  createTraceAndGeneration(
    traceInput: LangfuseTraceInput,
    generationInput: LangfuseGenerationInput,
  ): string | null {
    if (!this.enabled || !this.client) return null;

    try {
      const trace = this.client.trace({
        name: traceInput.name,
        metadata: traceInput.metadata,
        userId: traceInput.userId,
      });

      trace.generation({
        name: generationInput.name,
        model: generationInput.model,
        input: generationInput.input,
        output: generationInput.output,
        usage: generationInput.usage,
        metadata: generationInput.metadata,
      });

      return trace.id;
    } catch (error: any) {
      this.logger.warn(`Langfuse trace creation failed: ${error.message}`);
      return null;
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.flushAsync();
    } catch (error: any) {
      this.logger.warn(`Langfuse flush failed: ${error.message}`);
    }
  }
}
