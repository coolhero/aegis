// T001: Circuit Breaker Service — Redis-backed state machine
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@aegis/common/redis/redis.service';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
}

interface StoredState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: string | null;
  openedAt: string | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly config: CircuitBreakerConfig;
  // In-memory fallback when Redis is unavailable
  private readonly inMemoryState = new Map<string, StoredState>();
  private useInMemory = false;

  constructor(private readonly redisService: RedisService) {
    this.config = DEFAULT_CONFIG;
  }

  async getState(providerId: string): Promise<CircuitState> {
    const stored = await this.getStoredState(providerId);

    // Check if OPEN should transition to HALF_OPEN
    if (stored.state === 'OPEN' && stored.openedAt) {
      const elapsed = Date.now() - new Date(stored.openedAt).getTime();
      if (elapsed >= this.config.recoveryTimeoutMs) {
        await this.transitionTo(providerId, 'HALF_OPEN', 'recovery_timeout_elapsed');
        return 'HALF_OPEN';
      }
    }

    return stored.state;
  }

  async isOpen(providerId: string): Promise<boolean> {
    const state = await this.getState(providerId);
    return state === 'OPEN';
  }

  async recordSuccess(providerId: string): Promise<void> {
    const stored = await this.getStoredState(providerId);

    if (stored.state === 'HALF_OPEN') {
      // Probe succeeded — close the circuit
      await this.transitionTo(providerId, 'CLOSED', 'probe_success');
    }

    // Reset failure count on success
    stored.failureCount = 0;
    stored.state = 'CLOSED';
    await this.saveState(providerId, stored);
  }

  async recordFailure(providerId: string): Promise<void> {
    const stored = await this.getStoredState(providerId);

    if (stored.state === 'HALF_OPEN') {
      // Probe failed — reopen
      await this.transitionTo(providerId, 'OPEN', 'probe_failure');
      return;
    }

    stored.failureCount++;
    stored.lastFailureAt = new Date().toISOString();

    if (stored.failureCount >= this.config.failureThreshold && stored.state === 'CLOSED') {
      stored.state = 'OPEN';
      stored.openedAt = new Date().toISOString();
      this.logger.warn(
        `Circuit OPEN for provider ${providerId}: ${stored.failureCount} consecutive failures`,
      );
      await this.logTransition(providerId, 'CLOSED', 'OPEN', `failure_count=${stored.failureCount}`);
    }

    await this.saveState(providerId, stored);
  }

  async getFailureCount(providerId: string): Promise<number> {
    const stored = await this.getStoredState(providerId);
    return stored.failureCount;
  }

  private async transitionTo(providerId: string, newState: CircuitState, reason: string): Promise<void> {
    const stored = await this.getStoredState(providerId);
    const fromState = stored.state;

    stored.state = newState;
    if (newState === 'OPEN') {
      stored.openedAt = new Date().toISOString();
    }
    if (newState === 'CLOSED') {
      stored.failureCount = 0;
      stored.openedAt = null;
    }

    await this.saveState(providerId, stored);
    await this.logTransition(providerId, fromState, newState, reason);
  }

  private async logTransition(providerId: string, from: CircuitState, to: CircuitState, reason: string): Promise<void> {
    this.logger.warn(
      `Circuit transition: provider=${providerId}, ${from} → ${to}, reason=${reason}`,
    );
  }

  private async getStoredState(providerId: string): Promise<StoredState> {
    const defaultState: StoredState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureAt: null,
      openedAt: null,
    };

    if (this.useInMemory) {
      return this.inMemoryState.get(providerId) || { ...defaultState };
    }

    try {
      const key = `circuit:${providerId}`;
      const data = await this.redisService.get(key);

      if (!data) {
        return { ...defaultState };
      }

      return JSON.parse(data) as StoredState;
    } catch {
      // Redis unavailable — switch to in-memory
      this.useInMemory = true;
      this.logger.warn('Redis unavailable for circuit breaker — using in-memory fallback');
      return this.inMemoryState.get(providerId) || { ...defaultState };
    }
  }

  private async saveState(providerId: string, state: StoredState): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryState.set(providerId, { ...state });
      return;
    }

    try {
      const key = `circuit:${providerId}`;
      await this.redisService.set(key, JSON.stringify(state));
    } catch {
      this.useInMemory = true;
      this.inMemoryState.set(providerId, { ...state });
      this.logger.warn('Redis write failed — switched to in-memory circuit state');
    }
  }
}
