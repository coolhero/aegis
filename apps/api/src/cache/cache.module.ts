import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheEntry } from './cache-entry.entity';
import { CachePolicy } from './cache-policy.entity';
import { CacheService } from './cache.service';
import { CachePolicyService } from './cache-policy.service';
import { CacheStatsService } from './cache-stats.service';
import { EmbeddingService } from './embedding.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheController } from './cache.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CacheEntry, CachePolicy]),
    ConfigModule,
  ],
  controllers: [CacheController],
  providers: [
    CacheService,
    CachePolicyService,
    CacheStatsService,
    EmbeddingService,
    CacheInterceptor,
  ],
  exports: [CacheInterceptor, CacheService],
})
export class CacheModule {}
