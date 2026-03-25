import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';
import { RedisService } from '@aegis/common/redis/redis.service';
import { LoggerService } from '@aegis/common/logger/logger.service';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
        { provide: RedisService, useValue: mockRedisService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
  });

  it('should return ok status when both DB and Redis are up', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    redisService.isConnected.mockReturnValue(true);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.components.db).toBe('up');
    expect(result.components.redis).toBe('up');
    expect(result.timestamp).toBeDefined();
  });

  it('should return degraded status when Redis is down but DB is up', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    redisService.isConnected.mockReturnValue(false);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.components.db).toBe('up');
    expect(result.components.redis).toBe('down');
  });

  it('should return error status when DB is down', async () => {
    dataSource.query.mockRejectedValue(new Error('Connection refused'));
    redisService.isConnected.mockReturnValue(true);

    const result = await controller.check();

    expect(result.status).toBe('error');
    expect(result.components.db).toBe('down');
    expect(result.components.redis).toBe('up');
  });

  it('should return error status when both DB and Redis are down', async () => {
    dataSource.query.mockRejectedValue(new Error('Connection refused'));
    redisService.isConnected.mockReturnValue(false);

    const result = await controller.check();

    expect(result.status).toBe('error');
    expect(result.components.db).toBe('down');
    expect(result.components.redis).toBe('down');
  });
});
