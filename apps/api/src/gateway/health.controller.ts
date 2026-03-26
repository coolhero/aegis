// T011: Health Controller — GET /providers/health
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '@aegis/common/gateway';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LatencyTrackerService } from './latency-tracker.service';

@Controller('providers')
export class HealthController {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepo: Repository<Provider>,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly latencyTracker: LatencyTrackerService,
  ) {}

  @Get('health')
  @UseGuards(JwtAuthGuard)
  async getProviderHealth() {
    const providers = await this.providerRepo.find();

    const health = await Promise.all(
      providers.map(async (provider) => {
        const circuitState = await this.circuitBreaker.getState(provider.id);
        const avgLatency = await this.latencyTracker.getAvgLatency(provider.id);
        const errorRate = await this.latencyTracker.getErrorRate(provider.id);

        return {
          id: provider.id,
          name: provider.name,
          type: provider.type,
          enabled: provider.enabled,
          circuit_state: circuitState,
          failure_count: await this.circuitBreaker.getFailureCount(provider.id),
          avg_latency_ms: avgLatency,
          error_rate: Math.round(errorRate * 100) / 100,
          last_check_at: new Date().toISOString(),
          weight: provider.weight,
        };
      }),
    );

    return health;
  }
}
