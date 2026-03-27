import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { Roles } from '@aegis/common/auth/roles.decorator';
import { UserRole } from '@aegis/common';
import { DocumentService } from './document.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(202)
  async create(@Body() body: { title: string; content: string; contentType?: string }, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    const doc = await this.documentService.create(orgId, body);
    return {
      id: doc.id,
      title: doc.title,
      embeddingStatus: doc.embeddingStatus,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt,
    };
  }

  @Get()
  async findAll(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.documentService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.documentService.findOne(id, orgId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    await this.documentService.delete(id, orgId);
    return { deleted: true };
  }
}
