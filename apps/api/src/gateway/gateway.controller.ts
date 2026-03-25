import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatCompletionRequest } from '@aegis/common/gateway';
import { ApiKeyAuthGuard } from '@aegis/common';
import { GatewayService } from './gateway.service';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { ApiKeyService } from '../auth/api-key.service';

@Controller('v1')
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly logger: LoggerService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post('chat/completions')
  @UseGuards(ApiKeyAuthGuard)
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
        await this.handleStreaming(request, res);
      } else {
        await this.handleNonStreaming(request, res);
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleNonStreaming(
    request: ChatCompletionRequest,
    res: Response,
  ): Promise<void> {
    const response = await this.gatewayService.chat(request);
    res.status(200).json(response);
  }

  private async handleStreaming(
    request: ChatCompletionRequest,
    res: Response,
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

      res.end();
    } catch (error) {
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
