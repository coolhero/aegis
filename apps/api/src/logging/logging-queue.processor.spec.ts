import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoggingQueueProcessor, LogJobData } from './logging-queue.processor';
import { RequestLog } from './entities/request-log.entity';
import { LangfuseService } from './langfuse.service';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';

describe('LoggingQueueProcessor', () => {
  let processor: LoggingQueueProcessor;
  let requestLogRepo: Record<string, jest.Mock>;
  let langfuseService: Record<string, jest.Mock>;

  const mockJobData: LogJobData = {
    requestId: '00000000-0000-0000-0000-000000000001',
    traceId: 'trace-abc123',
    orgId: 'org-001',
    userId: 'user-001',
    teamId: 'team-001',
    model: 'gpt-4o',
    provider: 'openai',
    inputMasked: 'Hello',
    outputMasked: 'Hi there!',
    inputTokens: 5,
    outputTokens: 3,
    costUsd: 0.0001,
    latencyMs: 1200,
    status: 'success',
    errorDetail: null,
    cacheHit: false,
    estimated: false,
    inputSize: 5,
    outputSize: 9,
  };

  beforeEach(async () => {
    requestLogRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    langfuseService = {
      isEnabled: jest.fn().mockReturnValue(false),
      createTraceAndGeneration: jest.fn().mockReturnValue('lf-trace-001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingQueueProcessor,
        { provide: REDIS_CLIENT, useValue: { options: { host: 'localhost', port: 6379 } } },
        { provide: getRepositoryToken(RequestLog), useValue: requestLogRepo },
        { provide: LangfuseService, useValue: langfuseService },
      ],
    }).compile();

    processor = module.get(LoggingQueueProcessor);
  });

  it('should save RequestLog to DB', async () => {
    await processor.process(mockJobData);

    expect(requestLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: mockJobData.requestId,
        model: 'gpt-4o',
        status: 'success',
      }),
    );
  });

  it('should skip duplicate request_id (idempotency)', async () => {
    requestLogRepo.findOne.mockResolvedValue({ id: 'existing' });

    await processor.process(mockJobData);

    expect(requestLogRepo.save).not.toHaveBeenCalled();
  });

  it('should call Langfuse when enabled', async () => {
    langfuseService.isEnabled.mockReturnValue(true);

    await processor.process(mockJobData);

    expect(langfuseService.createTraceAndGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'llm-request' }),
      expect.objectContaining({ model: 'gpt-4o' }),
    );
    expect(requestLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ langfuseTraceId: 'lf-trace-001' }),
    );
  });

  it('should not call Langfuse when disabled', async () => {
    langfuseService.isEnabled.mockReturnValue(false);

    await processor.process(mockJobData);

    expect(langfuseService.createTraceAndGeneration).not.toHaveBeenCalled();
    expect(requestLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ langfuseTraceId: null }),
    );
  });

  it('should throw on DB save failure (triggers BullMQ retry)', async () => {
    requestLogRepo.save.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      processor.process({ data: mockJobData } as any),
    ).rejects.toThrow('DB connection lost');
  });
});
