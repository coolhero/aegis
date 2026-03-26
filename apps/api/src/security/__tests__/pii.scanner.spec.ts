import { PiiScanner } from '../scanners/pii.scanner';
import { SecurityPolicy } from '../entities/security-policy.entity';

describe('PiiScanner', () => {
  let scanner: PiiScanner;
  let defaultPolicy: SecurityPolicy;

  beforeEach(() => {
    scanner = new PiiScanner();
    defaultPolicy = {
      piiCategories: ['email', 'phone', 'ssn'],
      piiAction: 'mask',
      customPiiPatterns: [],
    } as unknown as SecurityPolicy;
  });

  it('should mask email addresses', () => {
    const result = scanner.scan('Contact me at john@example.com please', defaultPolicy);
    expect(result.decision).toBe('mask');
    expect(result.transformed).toBe('Contact me at [EMAIL] please');
    expect(result.details.detected).toContain('email');
  });

  it('should mask phone numbers', () => {
    const result = scanner.scan('Call 010-1234-5678', defaultPolicy);
    expect(result.decision).toBe('mask');
    expect(result.transformed).toBe('Call [PHONE]');
    expect(result.details.detected).toContain('phone');
  });

  it('should mask SSN (Korean resident ID)', () => {
    const result = scanner.scan('My ID is 900101-1234567', defaultPolicy);
    expect(result.decision).toBe('mask');
    expect(result.transformed).toBe('My ID is [SSN]');
    expect(result.details.detected).toContain('ssn');
  });

  it('should mask multiple PII types in one input', () => {
    const input = 'Email john@test.com, call 010-1111-2222';
    const result = scanner.scan(input, defaultPolicy);
    expect(result.decision).toBe('mask');
    expect(result.transformed).toContain('[EMAIL]');
    expect(result.transformed).toContain('[PHONE]');
  });

  it('should pass when no PII detected', () => {
    const result = scanner.scan('Hello, how are you?', defaultPolicy);
    expect(result.decision).toBe('pass');
    expect(result.transformed).toBeUndefined();
  });

  it('should reject when pii_action is reject', () => {
    const policy = { ...defaultPolicy, piiAction: 'reject' as const };
    const result = scanner.scan('Email: john@test.com', policy);
    expect(result.decision).toBe('block');
  });

  it('should pass with warning when pii_action is warn', () => {
    const policy = { ...defaultPolicy, piiAction: 'warn' as const };
    const result = scanner.scan('Email: john@test.com', policy);
    expect(result.decision).toBe('pass');
    expect(result.details.warning).toBe(true);
  });

  it('should skip categories not in policy', () => {
    const policy = { ...defaultPolicy, piiCategories: ['phone'] };
    const result = scanner.scan('Email: john@test.com', policy);
    expect(result.decision).toBe('pass');
  });

  it('should support custom PII patterns', () => {
    const policy = {
      ...defaultPolicy,
      piiCategories: ['employee_id'],
      customPiiPatterns: [
        { name: 'employee_id', pattern: 'EMP-\\d{4}', placeholder: '[EMPLOYEE_ID]' },
      ],
    };
    const result = scanner.scan('Employee EMP-1234 assigned', policy);
    expect(result.decision).toBe('mask');
    expect(result.transformed).toBe('Employee [EMPLOYEE_ID] assigned');
  });

  it('should return pass when no categories configured', () => {
    const policy = { ...defaultPolicy, piiCategories: [] };
    const result = scanner.scan('Email: john@test.com', policy);
    expect(result.decision).toBe('pass');
  });

  it('should measure latency', () => {
    const result = scanner.scan('test input', defaultPolicy);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
