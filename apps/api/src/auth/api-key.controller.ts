import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@aegis/common';
import { ApiKeyService } from './api-key.service';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @Body() body: { name: string; scopes?: string[]; expiresAt?: string },
    @Req() req: any,
  ) {
    const { orgId, userId } = req.user.tenantContext;
    return this.apiKeyService.create(orgId, userId, body);
  }

  @Get()
  async list(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.apiKeyService.list(orgId);
  }

  @Delete(':id')
  async revoke(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    const result = await this.apiKeyService.revoke(id, orgId);
    if (!result) {
      throw new NotFoundException('API key not found');
    }
    return result;
  }
}
