import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { McpServer } from './mcp-server.entity';

export type QueryType = 'rag' | 'mcp' | 'hybrid' | 'none';

@Injectable()
export class QueryRouterService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(McpServer)
    private readonly mcpServerRepo: Repository<McpServer>,
  ) {}

  async route(query: string, orgId: string): Promise<QueryType> {
    const queryLower = query.toLowerCase();

    // Check MCP: match registered tool names against query
    const mcpServers = await this.mcpServerRepo.find({
      where: { orgId, enabled: true },
    });

    let mcpMatch = false;
    for (const server of mcpServers) {
      for (const tool of server.tools || []) {
        const toolWords = tool.name.split(/[_\-\s]+/).map((w) => w.toLowerCase());
        if (toolWords.some((w) => queryLower.includes(w))) {
          mcpMatch = true;
          break;
        }
        if (tool.description && queryLower.includes(tool.description.toLowerCase().slice(0, 20))) {
          mcpMatch = true;
          break;
        }
      }
      if (mcpMatch) break;
    }

    // Check RAG: any documents with embeddings?
    const docCount = await this.documentRepo.count({
      where: { orgId, embeddingStatus: 'done' },
    });
    const hasRag = docCount > 0;

    if (mcpMatch && hasRag) return 'hybrid';
    if (mcpMatch) return 'mcp';
    if (hasRag) return 'rag';
    return 'none';
  }
}
