// T003: Latency Tracker Service — RedisService JSON-based
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@aegis/common/redis/redis.service';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface LatencyEntry {
  ts: number;
  latency: number;
}

interface LatencyData {
  entries: LatencyEntry[];
  errors: number;
  requests: number;
}

@Injectable()
export class LatencyTrackerService {
  private readonly logger = new Logger(LatencyTrackerService.name);
  private readonly inMemory = new Map<string, LatencyData>();

  constructor(private readonly redisService: RedisService) {}

  async recordLatency(providerId: string, latencyMs: number): Promise<void> {
    const data = await this.getData(providerId);
    const now = Date.now();

    data.entries.push({ ts: now, latency: latencyMs });
    data.requests++;

    // Clean old entries
    data.entries = data.entries.filter((e) => e.ts >= now - WINDOW_MS);

    await this.saveData(providerId, data);
  }

  async recordError(providerId: string): Promise<void> {
    const data = await this.getData(providerId);
    data.errors++;
    data.requests++;
    await this.saveData(providerId, data);
  }

  async getAvgLatency(providerId: string): Promise<number> {
    const data = await this.getData(providerId);
    const now = Date.now();
    const recent = data.entries.filter((e) => e.ts >= now - WINDOW_MS);

    if (recent.length === 0) return 0;
    return Math.round(recent.reduce((sum, e) => sum + e.latency, 0) / recent.length);
  }

  async getErrorRate(providerId: string): Promise<number> {
    const data = await this.getData(providerId);
    return data.requests > 0 ? data.errors / data.requests : 0;
  }

  private async getData(providerId: string): Promise<LatencyData> {
    const defaultData: LatencyData = { entries: [], errors: 0, requests: 0 };

    try {
      const key = `latency:${providerId}`;
      const raw = await this.redisService.get(key);
      if (!raw) {
        return this.inMemory.get(providerId) || { ...defaultData };
      }
      return JSON.parse(raw) as LatencyData;
    } catch {
      return this.inMemory.get(providerId) || { ...defaultData };
    }
  }

  private async saveData(providerId: string, data: LatencyData): Promise<void> {
    this.inMemory.set(providerId, data);

    try {
      const key = `latency:${providerId}`;
      await this.redisService.set(key, JSON.stringify(data), 600); // 10min TTL
    } catch {
      // In-memory already saved above
    }
  }
}
