import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestLog } from './entities/request-log.entity';
import { Organization } from '@aegis/common/auth/organization.entity';
import { DEFAULT_RETENTION_DAYS, LOG_BATCH_DELETE_SIZE } from './logging.constants';

@Injectable()
export class LogRetentionService {
  private readonly logger = new Logger(LogRetentionService.name);

  constructor(
    @InjectRepository(RequestLog)
    private readonly requestLogRepo: Repository<RequestLog>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  @Cron('0 3 * * *') // 매일 03:00 UTC
  async cleanExpiredLogs(): Promise<void> {
    this.logger.log('Starting log retention cleanup');

    try {
      const orgs = await this.orgRepo.find();
      let totalDeleted = 0;

      for (const org of orgs) {
        const retentionDays =
          (org.settings as any)?.logRetentionDays ?? DEFAULT_RETENTION_DAYS;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let deleted = 0;
        // Batch delete to avoid long-running transactions
        let batch: number;
        do {
          // Find batch of IDs first, then delete by IDs
          const toDelete = await this.requestLogRepo
            .createQueryBuilder('log')
            .select('log.id')
            .where('log.org_id = :orgId', { orgId: org.id })
            .andWhere('log.created_at < :cutoffDate', { cutoffDate })
            .take(LOG_BATCH_DELETE_SIZE)
            .getMany();

          batch = toDelete.length;
          if (batch > 0) {
            await this.requestLogRepo
              .createQueryBuilder()
              .delete()
              .from(RequestLog)
              .whereInIds(toDelete.map((l) => l.id))
              .execute();
          }
          deleted += batch;
        } while (batch === LOG_BATCH_DELETE_SIZE);

        if (deleted > 0) {
          this.logger.log(
            `Deleted ${deleted} expired logs for org ${org.id} (retention: ${retentionDays} days)`,
          );
        }
        totalDeleted += deleted;
      }

      this.logger.log(`Log retention cleanup complete: ${totalDeleted} logs deleted`);
    } catch (error: any) {
      this.logger.error(`Log retention cleanup failed: ${error.message}`);
    }
  }
}
