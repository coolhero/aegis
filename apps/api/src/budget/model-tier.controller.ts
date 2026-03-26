import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@aegis/common';
import {
  ModelTierService,
  CreateModelTierDto,
  UpdateModelTierDto,
} from './model-tier.service';

@Controller('model-tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ModelTierController {
  constructor(private readonly modelTierService: ModelTierService) {}

  @Post()
  async create(@Body() dto: CreateModelTierDto, @Req() req: any) {
    return this.modelTierService.create(req.user.orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.modelTierService.findAll(req.user.orgId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.modelTierService.findById(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateModelTierDto) {
    return this.modelTierService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.modelTierService.delete(id);
    return { message: 'Model tier deleted' };
  }
}
