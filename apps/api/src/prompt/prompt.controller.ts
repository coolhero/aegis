import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { Roles } from '@aegis/common/auth/roles.decorator';
import { UserRole } from '@aegis/common';
import { PromptService } from './prompt.service';
import { AbTestService } from './ab-test.service';
import { PromptResolverService } from './prompt-resolver.service';
import { PromptStatsService } from './prompt-stats.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PublishPromptDto } from './dto/publish-prompt.dto';
import { RollbackPromptDto } from './dto/rollback-prompt.dto';
import { CreateAbTestDto } from './dto/create-ab-test.dto';
import { ResolvePromptDto } from './dto/resolve-prompt.dto';

@Controller('prompts')
@UseGuards(JwtAuthGuard)
export class PromptController {
  constructor(
    private readonly promptService: PromptService,
    private readonly abTestService: AbTestService,
    private readonly resolverService: PromptResolverService,
    private readonly statsService: PromptStatsService,
  ) {}

  // --- CRUD ---

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(201)
  async create(@Body() dto: CreatePromptDto, @Req() req: any) {
    const { orgId, userId } = req.user.tenantContext;
    return this.promptService.create(orgId, userId, dto);
  }

  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.findAll(orgId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.findOne(id, orgId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async update(@Param('id') id: string, @Body() dto: UpdatePromptDto, @Req() req: any) {
    const { orgId, userId } = req.user.tenantContext;
    return this.promptService.update(id, orgId, userId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.delete(id, orgId);
  }

  // --- Versions ---

  @Get(':id/versions')
  async findVersions(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.findVersions(id, orgId);
  }

  // --- Publish / Rollback ---

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async publish(@Param('id') id: string, @Body() dto: PublishPromptDto, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.publish(id, orgId, dto.version);
  }

  @Post(':id/rollback')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async rollback(@Param('id') id: string, @Body() dto: RollbackPromptDto, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.promptService.rollback(id, orgId, dto.target_version, (templateId) =>
      this.abTestService.endTest(templateId),
    );
  }

  // --- A/B Test ---

  @Post(':id/ab-test')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(201)
  async createAbTest(@Param('id') id: string, @Body() dto: CreateAbTestDto, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    const template = await this.promptService.findOne(id, orgId);
    if (template.status !== 'published') {
      throw new ForbiddenException('A/B test can only be created for published prompts');
    }
    return this.abTestService.create(id, dto.variants);
  }

  @Get(':id/ab-test/stats')
  async getAbTestStats(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    await this.promptService.findOne(id, orgId); // verify ownership
    return this.abTestService.getStats(id);
  }

  @Delete(':id/ab-test')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  async endAbTest(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    await this.promptService.findOne(id, orgId);
    await this.abTestService.endTest(id);
    return { message: 'A/B test ended' };
  }

  // --- Resolve ---

  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolvePromptDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { orgId } = req.user.tenantContext;
    const result = await this.resolverService.resolve(id, orgId, dto.variables || {});

    if (result.variant_id) {
      res.setHeader('X-Prompt-Variant', result.variant_id);
    }

    return result;
  }

  // --- Stats ---

  @Get(':id/stats')
  async getStats(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    await this.promptService.findOne(id, orgId);
    return this.statsService.getStats(id);
  }
}
