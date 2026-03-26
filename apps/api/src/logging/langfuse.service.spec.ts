import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LangfuseService } from './langfuse.service';

describe('LangfuseService', () => {
  let service: LangfuseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangfuseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined), // No keys = disabled
          },
        },
      ],
    }).compile();

    service = module.get(LangfuseService);
  });

  it('should be disabled when keys are not configured', () => {
    expect(service.isEnabled()).toBe(false);
  });

  it('should return null from createTraceAndGeneration when disabled', () => {
    const result = service.createTraceAndGeneration(
      { name: 'test-trace', metadata: { orgId: 'org-1' } },
      { name: 'gen', model: 'gpt-4o', usage: { input: 10, output: 5, total: 15 } },
    );
    expect(result).toBeNull();
  });

  it('should not throw from flush when disabled', async () => {
    await expect(service.flush()).resolves.not.toThrow();
  });
});
