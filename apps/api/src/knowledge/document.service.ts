import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Document } from './document.entity';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectQueue('embedding')
    private readonly embeddingQueue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  async create(orgId: string, data: { title: string; content: string; contentType?: string }): Promise<Document> {
    const doc = this.documentRepo.create({
      orgId,
      title: data.title,
      content: data.content,
      contentType: data.contentType || 'text/markdown',
      embeddingStatus: 'pending',
    });
    const saved = await this.documentRepo.save(doc);

    // Enqueue embedding job
    await this.embeddingQueue.add('embed-document', { documentId: saved.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return saved;
  }

  async findAll(orgId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { orgId },
      order: { createdAt: 'DESC' },
      select: ['id', 'title', 'contentType', 'chunkCount', 'embeddingStatus', 'createdAt'],
    });
  }

  async findOne(id: string, orgId: string): Promise<Document> {
    const doc = await this.documentRepo.findOne({ where: { id, orgId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async delete(id: string, orgId: string): Promise<void> {
    const doc = await this.findOne(id, orgId);
    // Cascade: delete embeddings first (handled by ON DELETE CASCADE in entity)
    await this.documentRepo.remove(doc);
  }
}
