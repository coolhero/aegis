import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatCompletionRequest } from '@aegis/common/gateway';
import { ApiKeyAuthGuard } from '@aegis/common';
import { GatewayService } from './gateway.service';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { ApiKeyService } from '../auth/api-key.service';
import { BudgetGuard } from '../budget/budget.guard';
import { BudgetEngineService } from '../budget/budget-engine.service';
import { BudgetAlertService } from '../budget/budget-alert.service';
import { RequestLoggerInterceptor } from '../logging/request-logger.interceptor';
import { SecurityGuard } from '../security/security.guard';
import { GuardInterceptor } from '../security/guard.interceptor';
import { CacheInterceptor } from '../cache/cache.interceptor';

@Controller('v1')
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly logger: LoggerService,
    private readonly apiKeyService: ApiKeyService,
    private readonly budgetEngine: BudgetEngineService,
    private readonly budgetAlert: BudgetAlertService,
  ) {}

  @Post('chat/completions')
  @UseGuards(ApiKeyAuthGuard, SecurityGuard, BudgetGuard)
  @UseInterceptors(CacheInterceptor, RequestLoggerInterceptor, GuardInterceptor)
  async chatCompletions(
    @Body() request: ChatCompletionRequest,
    @Req() req: any,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Check model scope if API key has scopes defined
      if (req.apiKey) {
        this.apiKeyService.checkModelScope(req.apiKey, request.model);
      }

      if (request.stream) {
        await this.handleStreaming(request, res, req);
      } else {
        await this.handleNonStreaming(request, res, req);
      }
    } catch (error) {
      // Release budget reservation on error (FR-006)
      await this.releaseBudget(req);
      this.handleError(error, res);
    }
  }

  private async handleNonStreaming(
    request: ChatCompletionRequest,
    res: Response,
    req?: any,
  ): Promise<void> {
    const response = await this.gatewayService.chat(request);

    // Budget reconciliation (FR-016)
    await this.reconcileBudget(req, response.usage);

    // F008: Add fallback provider header
    const fallbackProvider = this.gatewayService.getLastFallbackProvider();
    if (fallbackProvider) {
      res.setHeader('X-Fallback-Provider', fallbackProvider);
    }

    res.status(200).json(response);
  }

  private async handleStreaming(
    request: ChatCompletionRequest,
    res: Response,
    req?: any,
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    try {
      const stream = this.gatewayService.chatStream(request);

      for await (const chunk of stream) {
        res.write(chunk);
      }

      // Budget reconciliation for streaming (FR-016)
      // TODO: Extract usage from final SSE chunk when available
      // For now, reconcile with estimated tokens
      await this.reconcileBudget(req, null);

      res.end();
    } catch (error) {
      // Release budget on streaming error
      await this.releaseBudget(req);
      // If error occurs before streaming starts
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Streaming setup error: ${message}`,
        'GatewayController',
      );

      const errorPayload = {
        error: {
          message,
          type: 'server_error',
          code: 'streaming_error',
          param: null,
        },
      };
      res.write(`event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  private async reconcileBudget(req: any, usage: any): Promise<void> {
    const reservation = req?.budgetReservation;
    if (!reservation) return;

    try {
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;

      await this.budgetEngine.reconcile({
        reservationId: reservation.reservationId,
        actualInputTokens: inputTokens,
        actualOutputTokens: outputTokens,
        costUsd: 0, // Cost calculated in engine from model pricing
      });
    } catch (error: any) {
      this.logger.error(
        `Budget reconciliation failed: ${error?.message}`,
        'GatewayController',
      );
    }
  }

  private async releaseBudget(req: any): Promise<void> {
    const reservation = req?.budgetReservation;
    if (!reservation) return;

    try {
      await this.budgetEngine.release(reservation.reservationId);
    } catch (error: any) {
      this.logger.error(
        `Budget release failed: ${error?.message}`,
        'GatewayController',
      );
    }
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as Record<string, unknown>).message ?? 'Unknown error';

      res.status(status).json({
        error: {
          message,
          type: status === 400 ? 'invalid_request_error' : 'server_error',
          code: null,
          param: null,
        },
      });
    } else {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      this.logger.error(
        `Unhandled error: ${message}`,
        'GatewayController',
      );

      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: null,
          param: null,
        },
      });
    }
  }
}
