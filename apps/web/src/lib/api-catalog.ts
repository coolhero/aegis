// F012 T008: Static API catalog for AEGIS endpoints

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  category: string;
  description: string;
  params?: ApiParam[];
  requestBody?: Record<string, any>;
}

export interface ApiParam {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description: string;
}

export const API_CATALOG: ApiEndpoint[] = [
  // F001 — Foundation
  { method: 'GET', path: '/health', category: 'Foundation', description: 'Health check (DB + Redis)' },

  // F002 — LLM Gateway
  {
    method: 'POST',
    path: '/v1/chat/completions',
    category: 'LLM Gateway',
    description: 'LLM chat completion (OpenAI compatible, SSE streaming)',
    requestBody: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    },
  },

  // F003 — Auth
  {
    method: 'POST',
    path: '/auth/login',
    category: 'Auth',
    description: 'JWT login',
    requestBody: { email: 'admin@aegis.local', password: 'admin123' },
  },
  { method: 'POST', path: '/auth/refresh', category: 'Auth', description: 'Refresh JWT token' },
  { method: 'GET', path: '/organizations', category: 'Auth', description: 'List organizations' },
  { method: 'GET', path: '/users', category: 'Auth', description: 'List users' },
  { method: 'POST', path: '/api-keys', category: 'Auth', description: 'Create API key' },
  { method: 'GET', path: '/api-keys', category: 'Auth', description: 'List API keys' },

  // F004 — Budget
  {
    method: 'GET',
    path: '/budgets/:level/:id',
    category: 'Budget',
    description: 'Get budget (level: org/team/user)',
    params: [
      { name: 'level', in: 'path', type: 'string', required: true, description: 'Budget level (org/team/user)' },
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Target ID' },
    ],
  },
  { method: 'GET', path: '/usage/summary', category: 'Budget', description: 'Usage summary' },

  // F005 — Logging
  { method: 'GET', path: '/logs', category: 'Logging', description: 'Request logs (search/filter)' },
  { method: 'GET', path: '/analytics/usage', category: 'Logging', description: 'Usage analytics' },
  { method: 'GET', path: '/analytics/cost', category: 'Logging', description: 'Cost analytics' },

  // F006 — Security
  {
    method: 'GET',
    path: '/security-policies/:orgId',
    category: 'Security',
    description: 'Get security policy',
    params: [{ name: 'orgId', in: 'path', type: 'string', required: true, description: 'Organization ID' }],
  },

  // F008 — Provider Health
  { method: 'GET', path: '/providers/health', category: 'Providers', description: 'Provider health status' },

  // F009 — Knowledge
  { method: 'POST', path: '/documents', category: 'Knowledge', description: 'Upload document (async embedding)' },
  { method: 'GET', path: '/documents', category: 'Knowledge', description: 'List documents' },
  { method: 'POST', path: '/knowledge/query', category: 'Knowledge', description: 'Knowledge query (MCP/RAG)' },

  // F010 — Prompts
  { method: 'GET', path: '/prompts', category: 'Prompts', description: 'List prompt templates' },
  { method: 'POST', path: '/prompts', category: 'Prompts', description: 'Create prompt template' },

  // F011 — Cache
  { method: 'GET', path: '/cache/stats', category: 'Cache', description: 'Cache statistics' },
  { method: 'DELETE', path: '/cache', category: 'Cache', description: 'Invalidate cache' },
  {
    method: 'PUT',
    path: '/cache/policy/:orgId',
    category: 'Cache',
    description: 'Set cache policy',
    params: [{ name: 'orgId', in: 'path', type: 'string', required: true, description: 'Organization ID' }],
    requestBody: { similarity_threshold: 0.95, ttl_seconds: 86400, enabled: true },
  },
];

export function getCategories(): string[] {
  return [...new Set(API_CATALOG.map((e) => e.category))];
}

export function getEndpointsByCategory(category: string): ApiEndpoint[] {
  return API_CATALOG.filter((e) => e.category === category);
}
