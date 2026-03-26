// T007: TanStack Query key constants

export const queryKeys = {
  auth: {
    user: ['auth', 'user'] as const,
  },
  usage: {
    summary: ['usage', 'summary'] as const,
    chart: (period: string) => ['usage', 'chart', period] as const,
    modelBreakdown: (period: string) => ['usage', 'model-breakdown', period] as const,
    teamBreakdown: (period: string) => ['usage', 'team-breakdown', period] as const,
  },
  budget: {
    get: (level: string, id: string) => ['budget', level, id] as const,
    list: (level: string) => ['budget', 'list', level] as const,
  },
  users: {
    list: ['users', 'list'] as const,
  },
  teams: {
    list: ['teams', 'list'] as const,
  },
  apiKeys: {
    list: ['api-keys', 'list'] as const,
  },
  logs: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: (filters: any) => ['logs', 'list', filters] as const,
    detail: (id: string) => ['logs', 'detail', id] as const,
  },
  analytics: {
    usage: (params: Record<string, unknown>) => ['analytics', 'usage', params] as const,
    cost: (params: Record<string, unknown>) => ['analytics', 'cost', params] as const,
  },
} as const;
