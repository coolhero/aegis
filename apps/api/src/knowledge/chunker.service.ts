import { Injectable } from '@nestjs/common';

export interface Chunk {
  index: number;
  content: string;
}

@Injectable()
export class ChunkerService {
  /**
   * Split text into chunks of ~chunkSize tokens with overlap.
   * Token estimation: words * 1.3
   */
  chunk(text: string, chunkSize = 500, overlap = 50): Chunk[] {
    const words = text.split(/\s+/);
    const wordsPerChunk = Math.floor(chunkSize / 1.3);
    const overlapWords = Math.floor(overlap / 1.3);
    const chunks: Chunk[] = [];

    let start = 0;
    let index = 0;

    while (start < words.length) {
      const end = Math.min(start + wordsPerChunk, words.length);
      const chunkWords = words.slice(start, end);
      chunks.push({
        index,
        content: chunkWords.join(' '),
      });
      index++;
      start = end - overlapWords;
      if (start >= words.length || end === words.length) break;
    }

    return chunks;
  }
}
