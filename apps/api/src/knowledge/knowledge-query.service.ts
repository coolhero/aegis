import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { QueryRouterService, QueryType } from './query-router.service';
import { McpServerService } from './mcp-server.service';

export interface KnowledgeQueryResult {
  type: QueryType;
  ragResults?: Array<{
    content: string;
    similarity: number;
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
  }>;
  mcpResults?: Array<{
    serverName: string;
    tool: string;
    result: unknown;
  }>;
  message?: string;
}

@Injectable()
export class KnowledgeQueryService {
  private readonly logger = new Logger(KnowledgeQueryService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly queryRouter: QueryRouterService,
    private readonly mcpServerService: McpServerService,
  ) {}

  async query(
    text: string,
    orgId: string,
    topK = 5,
    threshold = 0.7,
  ): Promise<KnowledgeQueryResult> {
    const queryType = await this.queryRouter.route(text, orgId);

    if (queryType === 'none') {
      return { type: 'none', message: '지식 소스를 먼저 설정하세요 (문서 업로드 또는 MCP 서버 등록)' };
    }

    const result: KnowledgeQueryResult = { type: queryType };

    if (queryType === 'rag' || queryType === 'hybrid') {
      const queryVector = await this.embeddingService.generateEmbedding(text);
      result.ragResults = await this.embeddingService.search(queryVector, orgId, topK, threshold);
    }

    if (queryType === 'mcp' || queryType === 'hybrid') {
      const mcpResult = await this.mcpServerService.findAndCallRelevantTool(text, orgId);
      if (mcpResult) {
        result.mcpResults = [mcpResult];
      }
    }

    return result;
  }
}
