import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: any) {}

  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected()) {
        this.logger.warn('Redis not connected, returning null for get');
        return null;
      }
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis get error for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        this.logger.warn('Redis not connected, skipping set');
        return false;
      }
      if (ttlSeconds) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Redis set error for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        this.logger.warn('Redis not connected, skipping del');
        return false;
      }
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.warn(
        `Redis del error for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
