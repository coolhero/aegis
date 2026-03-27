import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Document } from './document.entity';
import { Embedding } from './embedding.entity';
import { McpServer } from './mcp-server.entity';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { EmbeddingService } from './embedding.service';
import { EmbeddingWorker } from './embedding.worker';
import { ChunkerService } from './chunker.service';
import { KnowledgeQueryController } from './knowledge-query.controller';
import { KnowledgeQueryService } from './knowledge-query.service';
import { QueryRouterService } from './query-router.service';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Embedding, McpServer]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'embedding' }),
  ],
  controllers: [DocumentController, KnowledgeQueryController, McpServerController],
  providers: [
    DocumentService,
    EmbeddingService,
    EmbeddingWorker,
    ChunkerService,
    KnowledgeQueryService,
    QueryRouterService,
    McpServerService,
  ],
  exports: [KnowledgeQueryService],
})
export class KnowledgeModule {}
