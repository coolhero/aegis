import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { KnowledgeQueryService } from './knowledge-query.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeQueryController {
  constructor(private readonly queryService: KnowledgeQueryService) {}

  @Post('query')
  async query(
    @Body() body: { query: string; topK?: number; threshold?: number },
    @Req() req: any,
  ) {
    const { orgId } = req.user.tenantContext;
    return this.queryService.query(body.query, orgId, body.topK, body.threshold);
  }
}
