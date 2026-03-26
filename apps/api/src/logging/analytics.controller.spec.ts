import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { LoggingService } from './logging.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: Record<string, jest.Mock>;

  const req = { user: { orgId: 'org-001' } };

  beforeEach(async () => {
    service = {
      getUsageAnalytics: jest.fn().mockResolvedValue({
        data: [{ group: 'gpt-4o', period: '2026-03-01', request_count: 10 }],
        meta: { groupBy: 'model', period: 'daily' },
      }),
      getCostAnalytics: jest.fn().mockResolvedValue({
        data: [{ group: 'engineering', period: '2026-03', total_cost_usd: 125.5 }],
        meta: { groupBy: 'team', period: 'monthly' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: LoggingService, useValue: service }],
    }).compile();

    controller = module.get(AnalyticsController);
  });

  describe('GET /analytics/usage', () => {
    it('should return usage analytics', async () => {
      const result = await controller.getUsage(
        { groupBy: 'model', period: 'daily' },
        req,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.groupBy).toBe('model');
      expect(service.getUsageAnalytics).toHaveBeenCalledWith('org-001', {
        groupBy: 'model',
        period: 'daily',
      });
    });
  });

  describe('GET /analytics/cost', () => {
    it('should return cost analytics', async () => {
      const result = await controller.getCost(
        { groupBy: 'team', period: 'monthly' },
        req,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.groupBy).toBe('team');
      expect(service.getCostAnalytics).toHaveBeenCalledWith('org-001', {
        groupBy: 'team',
        period: 'monthly',
      });
    });
  });
});
