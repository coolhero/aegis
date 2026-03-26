import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoggingController } from './logging.controller';
import { LoggingService } from './logging.service';

describe('LoggingController', () => {
  let controller: LoggingController;
  let service: Record<string, jest.Mock>;

  const req = { user: { orgId: 'org-001' } };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: 'log-1', model: 'gpt-4o' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      findById: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoggingController],
      providers: [{ provide: LoggingService, useValue: service }],
    }).compile();

    controller = module.get(LoggingController);
  });

  describe('GET /logs', () => {
    it('should return paginated log list', async () => {
      const result = await controller.findAll({ page: 1, limit: 20 }, req);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(service.findAll).toHaveBeenCalledWith('org-001', { page: 1, limit: 20 });
    });
  });

  describe('GET /logs/:id', () => {
    it('should return log detail', async () => {
      const mockLog = { id: 'log-1', model: 'gpt-4o', inputMasked: 'Hello' };
      service.findById.mockResolvedValue(mockLog);

      const result = await controller.findById('log-1', req);
      expect(result).toEqual(mockLog);
    });

    it('should throw 404 for non-existent log', async () => {
      service.findById.mockResolvedValue(null);

      await expect(controller.findById('nonexistent', req)).rejects.toThrow(NotFoundException);
    });
  });
});
