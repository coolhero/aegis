// T033: SSE client with exponential backoff reconnection

export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface SSEClientOptions {
  url: string;
  token: string;
  onMessage: (event: MessageEvent) => void;
  onStatusChange: (status: SSEStatus) => void;
  maxRetries?: number;
  maxBackoff?: number;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private options: Required<SSEClientOptions>;
  private status: SSEStatus = 'disconnected';

  constructor(options: SSEClientOptions) {
    this.options = {
      maxRetries: 10,
      maxBackoff: 30000,
      ...options,
    };
  }

  connect(): void {
    this.setStatus('connecting');
    const url = `${this.options.url}?token=${encodeURIComponent(this.options.token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.retryCount = 0;
      this.setStatus('connected');
    };

    this.eventSource.onmessage = (event) => {
      this.options.onMessage(event);
    };

    this.eventSource.addEventListener('request_completed', (event) => {
      this.options.onMessage(event as MessageEvent);
    });

    this.eventSource.addEventListener('budget_alert', (event) => {
      this.options.onMessage(event as MessageEvent);
    });

    this.eventSource.addEventListener('ping', () => {
      // heartbeat — no action needed
    });

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.retryCount = 0;
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.options.maxRetries) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    const baseDelay = Math.min(1000 * Math.pow(2, this.retryCount), this.options.maxBackoff);
    const jitter = baseDelay * 0.1 * Math.random();
    const delay = baseDelay + jitter;

    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  private setStatus(status: SSEStatus): void {
    this.status = status;
    this.options.onStatusChange(status);
  }

  getStatus(): SSEStatus {
    return this.status;
  }

  getRetryCount(): number {
    return this.retryCount;
  }
}
