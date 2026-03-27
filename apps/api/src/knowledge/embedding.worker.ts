import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Document } from './document.entity';
import { ChunkerService } from './chunker.service';
import { EmbeddingService } from './embedding.service';

@Processor('embedding')
export class EmbeddingWorker extends WorkerHost {
  private readonly logger = new Logger(EmbeddingWorker.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly chunkerService: ChunkerService,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string }>): Promise<void> {
    const { documentId } = job.data;
    this.logger.log(`Processing document: ${documentId}`);

    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      this.logger.error(`Document ${documentId} not found`);
      return;
    }

    try {
      // Update status
      doc.embeddingStatus = 'processing';
      await this.documentRepo.save(doc);

      // Chunk
      const chunks = this.chunkerService.chunk(doc.content);
      this.logger.log(`Document ${documentId}: ${chunks.length} chunks created`);

      // Embed each chunk
      const embeddings = [];
      for (const chunk of chunks) {
        const vector = await this.embeddingService.generateEmbedding(chunk.content);
        embeddings.push({
          documentId: doc.id,
          chunkIndex: chunk.index,
          content: chunk.content,
          vector,
          metadata: { title: doc.title },
        });
      }

      // Bulk save
      await this.embeddingService.saveBulk(embeddings);

      // Update document
      doc.chunkCount = chunks.length;
      doc.embeddingStatus = 'done';
      doc.errorDetail = null;
      await this.documentRepo.save(doc);

      this.logger.log(`Document ${documentId}: embedding complete (${chunks.length} chunks)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Document ${documentId}: embedding failed — ${message}`);
      doc.embeddingStatus = 'failed';
      doc.errorDetail = message;
      await this.documentRepo.save(doc);
      throw error; // Let BullMQ handle retry
    }
  }
}
