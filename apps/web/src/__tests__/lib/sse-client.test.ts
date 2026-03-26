/**
 * @jest-environment jsdom
 */
import { SSEClient, SSEStatus } from '@/lib/sse-client';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Map<string, ((event: Event) => void)[]> = new Map();
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close() {
    this.readyState = 2;
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateError() {
    this.onerror?.();
  }

  simulateMessage(data: string, type?: string) {
    const event = { data, type: type || 'message' } as MessageEvent;
    if (type && this.listeners.has(type)) {
      this.listeners.get(type)!.forEach((l) => l(event));
    } else {
      this.onmessage?.(event);
    }
  }
}

(global as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource as unknown as typeof EventSource;

describe('SSEClient', () => {
  let statusChanges: SSEStatus[];
  let messages: MessageEvent[];

  beforeEach(() => {
    MockEventSource.instances = [];
    statusChanges = [];
    messages = [];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createClient(overrides = {}) {
    return new SSEClient({
      url: 'http://localhost:3000/events/stream',
      token: 'test-jwt',
      onMessage: (e) => messages.push(e),
      onStatusChange: (s) => statusChanges.push(s),
      ...overrides,
    });
  }

  it('connects and reports connected status', () => {
    const client = createClient();
    client.connect();

    expect(statusChanges).toContain('connecting');
    expect(MockEventSource.instances.length).toBe(1);

    MockEventSource.instances[0].simulateOpen();
    expect(statusChanges).toContain('connected');
  });

  it('includes token in URL', () => {
    const client = createClient();
    client.connect();

    expect(MockEventSource.instances[0].url).toContain('token=test-jwt');
  });

  it('disconnects cleanly', () => {
    const client = createClient();
    client.connect();
    MockEventSource.instances[0].simulateOpen();

    client.disconnect();
    expect(statusChanges[statusChanges.length - 1]).toBe('disconnected');
    expect(client.getRetryCount()).toBe(0);
  });

  it('schedules reconnect on error with exponential backoff', () => {
    const client = createClient({ maxRetries: 3 });
    client.connect();
    MockEventSource.instances[0].simulateOpen();

    // First error
    MockEventSource.instances[0].simulateError();
    expect(statusChanges).toContain('reconnecting');

    // Advance past first backoff (~1s)
    jest.advanceTimersByTime(1500);
    expect(MockEventSource.instances.length).toBe(2); // New connection attempted
  });

  it('resets retry count on successful connect', () => {
    const client = createClient();
    client.connect();
    MockEventSource.instances[0].simulateOpen();
    expect(client.getRetryCount()).toBe(0);
  });
});
