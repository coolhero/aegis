import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@aegis/common';
import { SecurityPolicyService } from './security-policy.service';
import { UpdateSecurityPolicyDto } from './dto/update-security-policy.dto';

@Controller('security-policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityPolicyController {
  constructor(private readonly policyService: SecurityPolicyService) {}

  @Get(':orgId')
  async getPolicy(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: any,
  ) {
    // Verify tenant isolation (JWT: req.user, API Key: req.tenantContext)
    const tenantOrgId = req.user?.orgId ?? req.tenantContext?.orgId;
    if (tenantOrgId && tenantOrgId !== orgId) {
      throw new ForbiddenException('Cannot access other organization policies');
    }

    const policy = await this.policyService.getPolicy(orgId);

    return {
      id: policy.id ?? null,
      org_id: policy.orgId,
      pii_categories: policy.piiCategories,
      pii_action: policy.piiAction,
      injection_defense_enabled: policy.injectionDefenseEnabled,
      content_filter_categories: policy.contentFilterCategories,
      bypass_roles: policy.bypassRoles,
      custom_pii_patterns: policy.customPiiPatterns,
      updated_at: policy.updatedAt ?? null,
    };
  }

  @Put(':orgId')
  @Roles(UserRole.ADMIN)
  async updatePolicy(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateSecurityPolicyDto,
    @Req() req: any,
  ) {
    // Verify tenant isolation (JWT: req.user, API Key: req.tenantContext)
    const tenantOrgId = req.user?.orgId ?? req.tenantContext?.orgId;
    if (tenantOrgId && tenantOrgId !== orgId) {
      throw new ForbiddenException('Cannot modify other organization policies');
    }

    const policy = await this.policyService.updatePolicy(orgId, dto);

    return {
      id: policy.id,
      org_id: policy.orgId,
      pii_categories: policy.piiCategories,
      pii_action: policy.piiAction,
      injection_defense_enabled: policy.injectionDefenseEnabled,
      content_filter_categories: policy.contentFilterCategories,
      bypass_roles: policy.bypassRoles,
      custom_pii_patterns: policy.customPiiPatterns,
      updated_at: policy.updatedAt,
    };
  }
}
