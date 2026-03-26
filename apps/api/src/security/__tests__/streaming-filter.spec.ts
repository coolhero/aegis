import { StreamingFilter } from '../streaming-filter';
import { PiiScanner } from '../scanners/pii.scanner';
import { SecurityPolicy } from '../entities/security-policy.entity';

describe('StreamingFilter', () => {
  let filter: StreamingFilter;
  let policy: SecurityPolicy;

  beforeEach(() => {
    policy = {
      piiCategories: ['email'],
      piiAction: 'mask',
      injectionDefenseEnabled: true,
      contentFilterCategories: [],
      bypassRoles: [],
      customPiiPatterns: [],
    } as unknown as SecurityPolicy;
    filter = new StreamingFilter(new PiiScanner(), policy);
  });

  it('should buffer initial small chunks', () => {
    const result = filter.processChunk('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
    expect(result).toBe(''); // Buffered, not sent yet
  });

  it('should flush on stream end [DONE]', () => {
    filter.processChunk('data: {"choices":[{"delta":{"content":"Hello world this is a test message"}}]}\n\n');
    const result = filter.processChunk('data: [DONE]\n\n');
    expect(result).toContain('Hello world');
    expect(result).toContain('[DONE]');
  });

  it('should mask PII in streamed content', () => {
    // Send enough content to trigger flush, including email
    filter.processChunk(
      'data: {"choices":[{"delta":{"content":"Contact user at john@example.com for more details about the project"}}]}\n\n',
    );
    const result = filter.flush();
    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('john@example.com');
  });

  it('should pass through non-content chunks', () => {
    const chunk = 'event: ping\n\n';
    const result = filter.processChunk(chunk);
    expect(result).toBe(chunk);
  });

  it('should handle empty flush', () => {
    const result = filter.flush();
    expect(result).toBe('');
  });
});
