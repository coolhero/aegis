import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { LoggerService } from '@aegis/common/logger/logger.service';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@aegis/common/gateway';
import { Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { ApiKeyService } from '../auth/api-key.service';
import { ApiKeyAuthGuard } from '@aegis/common';
import { BudgetEngineService } from '../budget/budget-engine.service';
import { BudgetAlertService } from '../budget/budget-alert.service';
import { BudgetGuard } from '../budget/budget.guard';
import { RequestLoggerInterceptor } from '../logging/request-logger.interceptor';
import { SecurityGuard } from '../security/security.guard';
import { GuardInterceptor } from '../security/guard.interceptor';
import { CacheInterceptor } from '../cache/cache.interceptor';

describe('GatewayController', () => {
  let controller: GatewayController;
  let gatewayService: jest.Mocked<GatewayService>;

  const mockResponse = (): jest.Mocked<Response> => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;
    return res;
  };

  beforeEach(async () => {
    const mockGatewayService = {
      chat: jest.fn(),
      chatStream: jest.fn(),
      getLastFallbackProvider: jest.fn().mockReturnValue(null),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockApiKeyService = {
      checkModelScope: jest.fn(),
    };

    const mockBudgetEngine = {
      reconcile: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      isRedisAvailable: jest.fn().mockReturnValue(true),
    };

    const mockBudgetAlert = {
      checkAndAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        { provide: GatewayService, useValue: mockGatewayService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ApiKeyService, useValue: mockApiKeyService },
        { provide: BudgetEngineService, useValue: mockBudgetEngine },
        { provide: BudgetAlertService, useValue: mockBudgetAlert },
      ],
    })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BudgetGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SecurityGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(RequestLoggerInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .overrideInterceptor(GuardInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .compile();

    controller = module.get<GatewayController>(GatewayController);
    gatewayService = module.get(GatewayService);
  });

  describe('Non-streaming completion', () => {
    it('should return OpenAI-compatible response for non-streaming request', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };

      const expectedResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 3,
          total_tokens: 8,
        },
      };

      gatewayService.chat.mockResolvedValue(expectedResponse);

      const res = mockResponse();
      await controller.chatCompletions(request, { apiKey: null }, res);

      expect(gatewayService.chat).toHaveBeenCalledWith(request);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedResponse);
    });
  });

  describe('Streaming completion', () => {
    it('should set SSE headers and stream chunks', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const chunks = [
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n',
      ];

      async function* mockStream(): AsyncGenerator<string, void, unknown> {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      gatewayService.chatStream.mockReturnValue(mockStream());

      const res = mockResponse();
      await controller.chatCompletions(request, { apiKey: null }, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Connection',
        'keep-alive',
      );
      expect(res.flushHeaders).toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledTimes(3);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('Unknown model error handling', () => {
    it('should return 400 error for unknown model', async () => {
      const request: ChatCompletionRequest = {
        model: 'unknown-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };

      gatewayService.chat.mockRejectedValue(
        new BadRequestException(
          'Model "unknown-model" not found or not available.',
        ),
      );

      const res = mockResponse();
      await controller.chatCompletions(request, { apiKey: null }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'invalid_request_error',
          }),
        }),
      );
    });
  });

  describe('Anthropic format conversion', () => {
    it('should route Anthropic model and return OpenAI-compatible response', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
        stream: false,
      };

      const expectedResponse: ChatCompletionResponse = {
        id: 'chatcmpl-msg_123',
        object: 'chat.completion',
        created: 1700000000,
        model: 'claude-sonnet-4-20250514',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello! How can I help?' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 6,
          total_tokens: 21,
        },
      };

      gatewayService.chat.mockResolvedValue(expectedResponse);

      const res = mockResponse();
      await controller.chatCompletions(request, { apiKey: null }, res);

      expect(gatewayService.chat).toHaveBeenCalledWith(request);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                role: 'assistant',
              }),
            }),
          ]),
          usage: expect.objectContaining({
            prompt_tokens: expect.any(Number),
            completion_tokens: expect.any(Number),
            total_tokens: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('Provider error during streaming', () => {
    it('should handle error gracefully when stream setup fails', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      async function* mockErrorStream(): AsyncGenerator<string, void, unknown> {
        yield 'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n';
        throw new Error('Provider connection lost');
      }

      gatewayService.chatStream.mockReturnValue(mockErrorStream());

      const res = mockResponse();
      await controller.chatCompletions(request, { apiKey: null }, res);

      // SSE headers should still be set
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      // Should have written at least the first chunk
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });
  });
});
