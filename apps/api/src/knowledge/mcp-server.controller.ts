import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { Roles } from '@aegis/common/auth/roles.decorator';
import { UserRole } from '@aegis/common';
import { McpServerService } from './mcp-server.service';

@Controller('mcp-servers')
@UseGuards(JwtAuthGuard)
export class McpServerController {
  constructor(private readonly mcpServerService: McpServerService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @Body() body: { name: string; url: string; protocolVersion?: string },
    @Req() req: any,
  ) {
    const { orgId } = req.user.tenantContext;
    return this.mcpServerService.create(orgId, body);
  }

  @Get()
  async findAll(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.mcpServerService.findAll(orgId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    await this.mcpServerService.delete(id, orgId);
    return { deleted: true };
  }

  @Post(':id/call')
  async callTool(
    @Param('id') id: string,
    @Body() body: { tool: string; arguments: Record<string, unknown> },
    @Req() req: any,
  ) {
    const { orgId } = req.user.tenantContext;
    const result = await this.mcpServerService.callTool(id, orgId, body.tool, body.arguments);
    return { result };
  }
}
