import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '@aegis/common/redis/redis.service';
import { LoggerService } from '@aegis/common/logger/logger.service';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  components: {
    db: 'up' | 'down';
    redis: 'up' | 'down';
  };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();

    let status: 'ok' | 'degraded' | 'error';
    if (!dbStatus) {
      status = 'error';
    } else if (!redisStatus) {
      status = 'degraded';
    } else {
      status = 'ok';
    }

    return {
      status,
      components: {
        db: dbStatus ? 'up' : 'down',
        redis: redisStatus ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HealthController',
      );
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return this.redisService.isConnected();
    } catch (error) {
      this.logger.error(
        `Redis health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HealthController',
      );
      return false;
    }
  }
}
