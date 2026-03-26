import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggerInterceptor } from './request-logger.interceptor';
import { LoggingQueueProcessor } from './logging-queue.processor';
import { Model } from '@aegis/common/gateway/model.entity';

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;
  let mockQueue: Record<string, jest.Mock>;
  let modelRepo: Record<string, jest.Mock>;

  const createMockContext = (apiKey: any = null, body: any = {}): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        apiKey,
        body,
        id: 'req-001',
        headers: {},
      }),
    }),
  }) as unknown as ExecutionContext;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    modelRepo = {
      findOne: jest.fn().mockResolvedValue({
        inputPricePerToken: 0.0000025,
        outputPricePerToken: 0.00001,
      }),
    };

    const mockProcessor = { queue: mockQueue };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestLoggerInterceptor,
        { provide: LoggingQueueProcessor, useValue: mockProcessor },
        { provide: getRepositoryToken(Model), useValue: modelRepo },
      ],
    }).compile();

    interceptor = module.get(RequestLoggerInterceptor);
  });

  it('should pass through when no API key (internal request)', (done) => {
    const ctx = createMockContext(null);
    const handler: CallHandler = { handle: () => of({ data: 'ok' }) };

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ data: 'ok' });
        expect(mockQueue.add).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should enqueue log on successful non-streaming response', (done) => {
    const ctx = createMockContext(
      { orgId: 'org-1', userId: 'user-1', teamId: 'team-1' },
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
    );

    const response = {
      choices: [{ message: { content: 'Hi there!' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    };

    const handler: CallHandler = { handle: () => of(response) };

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        // Use setTimeout to let the async tap complete
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'log',
            expect.objectContaining({
              model: 'gpt-4o',
              provider: 'openai',
              status: 'success',
              inputTokens: 5,
              outputTokens: 3,
              estimated: false,
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should enqueue error log on failed request', (done) => {
    const ctx = createMockContext(
      { orgId: 'org-1', userId: 'user-1', teamId: null },
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
    );

    const handler: CallHandler = {
      handle: () => throwError(() => new Error('Provider timeout')),
    };

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'log',
            expect.objectContaining({
              status: 'error',
              errorDetail: 'Provider timeout',
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should set estimated=true when response has no usage', (done) => {
    const ctx = createMockContext(
      { orgId: 'org-1', userId: 'user-1', teamId: null },
      { model: 'claude-sonnet-4', messages: [{ role: 'user', content: 'Hello' }] },
    );

    const response = {
      choices: [{ message: { content: 'Hi!' } }],
      // No usage field
    };

    const handler: CallHandler = { handle: () => of(response) };

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'log',
            expect.objectContaining({
              estimated: true,
              provider: 'anthropic',
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should calculate cost from Model entity pricing', (done) => {
    const ctx = createMockContext(
      { orgId: 'org-1', userId: 'user-1', teamId: null },
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
    );

    const response = {
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };

    const handler: CallHandler = { handle: () => of(response) };

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        setTimeout(() => {
          // cost = 0.0000025 * 100 + 0.00001 * 50 = 0.00025 + 0.0005 = 0.00075
          expect(mockQueue.add).toHaveBeenCalledWith(
            'log',
            expect.objectContaining({
              costUsd: 0.00075,
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });
});
