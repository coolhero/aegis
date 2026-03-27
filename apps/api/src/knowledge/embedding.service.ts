import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Embedding } from './embedding.entity';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @InjectRepository(Embedding)
    private readonly embeddingRepo: Repository<Embedding>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate embedding vector for a text using OpenAI API.
   * Uses OPENAI_API_KEY env var.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — returning mock embedding');
      // Return deterministic mock embedding for development
      return Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01 + text.length * 0.001));
    }

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: text,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    return response.data.data[0].embedding;
  }

  /**
   * Save multiple embeddings to DB.
   */
  async saveBulk(embeddings: Partial<Embedding>[]): Promise<void> {
    // Use raw SQL for pgvector insertion
    for (const emb of embeddings) {
      await this.dataSource.query(
        `INSERT INTO embedding (id, "documentId", "chunkIndex", content, vector, metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5::jsonb, now())`,
        [
          emb.documentId,
          emb.chunkIndex,
          emb.content,
          `[${emb.vector!.join(',')}]`,
          JSON.stringify(emb.metadata || {}),
        ],
      );
    }
  }

  /**
   * Search for similar embeddings using cosine similarity.
   */
  async search(
    queryVector: number[],
    orgId: string,
    topK = 5,
    threshold = 0.7,
  ): Promise<Array<{ content: string; similarity: number; documentId: string; documentTitle: string; chunkIndex: number }>> {
    const vectorStr = `[${queryVector.join(',')}]`;

    const results = await this.dataSource.query(
      `SELECT e.content, e."chunkIndex", e."documentId",
              d.title AS "documentTitle",
              1 - (e.vector <=> $1::vector) AS similarity
       FROM embedding e
       JOIN document d ON d.id = e."documentId"
       WHERE d."orgId" = $2
         AND 1 - (e.vector <=> $1::vector) >= $3
       ORDER BY similarity DESC
       LIMIT $4`,
      [vectorStr, orgId, threshold, topK],
    );

    return results;
  }
}
