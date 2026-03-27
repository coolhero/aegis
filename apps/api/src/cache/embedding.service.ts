import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly model = 'text-embedding-3-small';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.apiKey || !text.trim()) {
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.slice(0, 8000), // limit input length
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Embedding API failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (error: any) {
      this.logger.warn(`Embedding generation failed: ${error?.message}`);
      return null; // fail-open
    }
  }
}
