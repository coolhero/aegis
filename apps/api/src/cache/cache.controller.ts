import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { Roles } from '@aegis/common/auth/roles.decorator';
import { UserRole } from '@aegis/common';
import { CacheService } from './cache.service';
import { CachePolicyService } from './cache-policy.service';
import { CacheStatsService } from './cache-stats.service';
import { UpdateCachePolicyDto } from './dto/update-cache-policy.dto';

@Controller('cache')
@UseGuards(JwtAuthGuard)
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly policyService: CachePolicyService,
    private readonly statsService: CacheStatsService,
  ) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.statsService.getStats(orgId);
  }

  @Delete()
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async invalidate(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    const deletedCount = await this.cacheService.invalidateOrg(orgId);
    return { message: 'Cache invalidated', deleted_count: deletedCount };
  }

  @Get('policy/:orgId')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async getPolicy(@Param('orgId') orgId: string, @Req() req: any) {
    const userOrgId = req.user.tenantContext.orgId;
    if (orgId !== userOrgId) {
      throw new NotFoundException();
    }
    const policy = await this.policyService.getPolicy(orgId);
    return { org_id: orgId, ...policy };
  }

  @Put('policy/:orgId')
  @Roles(UserRole.ADMIN)
  async updatePolicy(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateCachePolicyDto,
    @Req() req: any,
  ) {
    const userOrgId = req.user.tenantContext.orgId;
    if (orgId !== userOrgId) {
      throw new NotFoundException();
    }
    const policy = await this.policyService.updatePolicy(orgId, dto);
    return {
      org_id: policy.orgId,
      similarity_threshold: Number(policy.similarityThreshold),
      ttl_seconds: policy.ttlSeconds,
      enabled: policy.enabled,
      updated_at: policy.updatedAt,
    };
  }
}
