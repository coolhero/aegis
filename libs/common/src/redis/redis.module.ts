import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as IORedis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

// Handle both ESM and CJS default export patterns
const Redis = (IORedis as any).default || IORedis;

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');

        const client = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: 3,
          retryStrategy(times: number): number | null {
            if (times > 3) {
              logger.warn(
                'Redis connection failed after 3 retries. Running without Redis.',
              );
              return null;
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });

        client.on('error', (err: Error) => {
          logger.warn(`Redis connection error: ${err.message}`);
        });

        client.on('connect', () => {
          logger.log('Redis connected successfully');
        });

        client.connect().catch((err: Error) => {
          logger.warn(
            `Redis initial connection failed: ${err.message}. App will continue without Redis.`,
          );
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
