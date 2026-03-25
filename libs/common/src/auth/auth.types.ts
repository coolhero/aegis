export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  orgId: string;
  teamId: string | null;
  iat?: number;
  exp?: number;
}

export interface TenantContext {
  orgId: string;
  userId: string;
  role: UserRole | null;
}

export interface ApiKeyPayload {
  keyId: string;
  orgId: string;
  scopes: string[];
}
