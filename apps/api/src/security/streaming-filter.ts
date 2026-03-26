import { SecurityPolicy } from './entities/security-policy.entity';
import { PiiScanner } from './scanners/pii.scanner';

const BUFFER_WINDOW = 50; // chars to hold at boundary for PII reassembly

export class StreamingFilter {
  private buffer = '';
  private readonly piiScanner: PiiScanner;
  private readonly policy: SecurityPolicy;

  constructor(piiScanner: PiiScanner, policy: SecurityPolicy) {
    this.piiScanner = piiScanner;
    this.policy = policy;
  }

  /**
   * Process a streaming chunk. Returns the safe-to-send content.
   * PG-003: Maintains buffer window to catch PII split across chunks.
   * PG-005: Only returns content after filtering (filter → send, never send → filter).
   */
  processChunk(chunk: string): string {
    // Check for stream end signal
    if (chunk.includes('[DONE]')) {
      // Flush remaining buffer
      const remaining = this.flush();
      return remaining + chunk;
    }

    // Extract content from SSE data line
    const content = this.extractContent(chunk);
    if (content === null) {
      // Non-content chunk (e.g., event: or empty line) — pass through
      return chunk;
    }

    this.buffer += content;

    if (this.buffer.length <= BUFFER_WINDOW) {
      // Not enough data to safely scan — hold in buffer
      return '';
    }

    // Scan the full buffer for PII
    const result = this.piiScanner.scan(this.buffer, this.policy);
    const scannedText = result.transformed ?? this.buffer;

    // Keep last BUFFER_WINDOW chars in buffer, flush the rest
    const safeToSend = scannedText.slice(0, scannedText.length - BUFFER_WINDOW);
    this.buffer = this.buffer.slice(this.buffer.length - BUFFER_WINDOW);

    if (safeToSend.length === 0) {
      return '';
    }

    // Reconstruct SSE format
    return this.wrapAsSSE(safeToSend);
  }

  /**
   * Flush remaining buffer at stream end.
   */
  flush(): string {
    if (this.buffer.length === 0) return '';

    const result = this.piiScanner.scan(this.buffer, this.policy);
    const content = result.transformed ?? this.buffer;
    this.buffer = '';

    return this.wrapAsSSE(content);
  }

  private extractContent(chunk: string): string | null {
    // SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
    const match = chunk.match(/data:\s*(\{.*\})/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[1]);
      return parsed?.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }

  private wrapAsSSE(content: string): string {
    const data = JSON.stringify({
      choices: [{ delta: { content } }],
    });
    return `data: ${data}\n\n`;
  }
}
