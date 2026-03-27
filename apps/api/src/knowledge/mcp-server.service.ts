import { Injectable, Logger, NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { McpServer, McpTool } from './mcp-server.entity';

const MCP_TIMEOUT = 5000; // 5 seconds

@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepo: Repository<McpServer>,
  ) {}

  async create(orgId: string, data: { name: string; url: string; protocolVersion?: string }): Promise<McpServer> {
    const server = this.mcpServerRepo.create({
      orgId,
      name: data.name,
      url: data.url,
      protocolVersion: data.protocolVersion || '2024-11-05',
    });

    // Fetch tools list
    try {
      const tools = await this.fetchToolsList(data.url);
      server.tools = tools;
      server.healthStatus = 'healthy';
    } catch (error) {
      this.logger.warn(`Failed to fetch tools from ${data.url}: ${error}`);
      server.tools = [];
      server.healthStatus = 'unhealthy';
    }

    return this.mcpServerRepo.save(server);
  }

  async findAll(orgId: string): Promise<McpServer[]> {
    return this.mcpServerRepo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, orgId: string): Promise<McpServer> {
    const server = await this.mcpServerRepo.findOne({ where: { id, orgId } });
    if (!server) throw new NotFoundException('MCP server not found');
    return server;
  }

  async delete(id: string, orgId: string): Promise<void> {
    const server = await this.findOne(id, orgId);
    await this.mcpServerRepo.remove(server);
  }

  async callTool(serverId: string, orgId: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
    const server = await this.findOne(serverId, orgId);

    try {
      const response = await axios.post(
        server.url,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: tool, arguments: args },
          id: Date.now(),
        },
        { timeout: MCP_TIMEOUT, headers: { 'Content-Type': 'application/json' } },
      );

      if (response.data.error) {
        throw new Error(response.data.error.message || 'MCP tool error');
      }

      return response.data.result;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new GatewayTimeoutException('MCP server did not respond within 5 seconds');
      }
      throw error;
    }
  }

  async findAndCallRelevantTool(
    query: string,
    orgId: string,
  ): Promise<{ serverName: string; tool: string; result: unknown } | null> {
    const servers = await this.mcpServerRepo.find({ where: { orgId, enabled: true } });
    const queryLower = query.toLowerCase();

    for (const server of servers) {
      for (const tool of server.tools || []) {
        const toolWords = tool.name.split(/[_\-\s]+/).map((w) => w.toLowerCase());
        if (toolWords.some((w) => queryLower.includes(w))) {
          try {
            const result = await this.callTool(server.id, orgId, tool.name, { query });
            return { serverName: server.name, tool: tool.name, result };
          } catch (error) {
            this.logger.warn(`MCP tool call failed: ${server.name}/${tool.name}: ${error}`);
          }
        }
      }
    }

    return null;
  }

  private async fetchToolsList(url: string): Promise<McpTool[]> {
    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      },
      { timeout: MCP_TIMEOUT, headers: { 'Content-Type': 'application/json' } },
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return (response.data.result?.tools || []) as McpTool[];
  }
}
