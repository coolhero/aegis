# Implementation Plan: F003 — Auth & Multi-tenancy

**Branch**: `003-auth-multi-tenancy` | **Date**: 2025-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-auth-multi-tenancy/spec.md`

## Summary

API Key 인증과 JWT 세션 관리를 구현하고, Organization > Team > User 계층 구조 기반 멀티테넌시 + RBAC를 제공한다. NestJS Guard/Middleware 패턴으로 전 Feature에 인증/인가 기반을 확립한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, @nestjs/jwt, @nestjs/passport, passport-jwt, bcryptjs
**Storage**: PostgreSQL (TypeORM), Redis (세션/캐시 향후)
**Testing**: Jest + Supertest
**Target Platform**: Linux server (Docker)
**Project Type**: Web service (API gateway)
**Constraints**: MVP scope — Row-Level tenant isolation, 단일 Refresh Token per user

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Tenant Data Isolation | ✅ Pass | org_id 기반 Row-Level isolation, 모든 쿼리에 tenant 필터 |
| Secure Token Storage | ✅ Pass | API Key: SHA-256, Password: bcrypt, Refresh Token: SHA-256 |
| Start Simple (YAGNI) | ✅ Pass | 단일 refresh token, shared table, custom guard |
| Audit Trail | ⏩ Deferred | F005에서 처리 |
| Contract Testing | ⏩ Deferred | 외부 API 없음 (내부 인증만) |

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-multi-tenancy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth.contract.md
│   ├── organizations.contract.md
│   └── api-keys.contract.md
└── tasks.md             # Phase 2 output
```

### Source Code

```text
libs/common/src/auth/
├── index.ts                      # Barrel export
├── auth.types.ts                 # Role enum, JwtPayload, TenantContext interfaces
├── organization.entity.ts        # Organization TypeORM entity
├── team.entity.ts                # Team TypeORM entity
├── user.entity.ts                # User TypeORM entity (with @BeforeInsert hash)
├── api-key.entity.ts             # ApiKey TypeORM entity
├── jwt-auth.guard.ts             # JWT Bearer Guard
├── api-key-auth.guard.ts         # x-api-key Guard
├── roles.guard.ts                # RBAC Roles Guard
├── roles.decorator.ts            # @Roles() decorator
└── tenant-context.middleware.ts  # TenantContext extraction middleware

apps/api/src/auth/
├── auth.module.ts                # NestJS AuthModule
├── auth.service.ts               # Login, refresh, token logic
├── auth.controller.ts            # POST /auth/login, /auth/refresh
├── auth.controller.spec.ts       # Controller unit tests
├── api-key.service.ts            # API Key CRUD
├── api-key.controller.ts         # API Key endpoints
├── organization.controller.ts    # Organization/Team/User CRUD
└── seed.service.ts               # Demo seed data
```

## Architecture

### Authentication Flow

```
Client Request
  │
  ├─ x-api-key header? ──→ ApiKeyGuard ──→ SHA-256 hash → DB lookup
  │                                         → TenantContext(orgId)
  │
  └─ Authorization: Bearer? ──→ JwtAuthGuard ──→ passport-jwt verify
                                                  → TenantContext(orgId from JWT claim)
  │
  └─ Neither? ──→ 401 Unauthorized
  │
  ▼
  RolesGuard ──→ Check @Roles() decorator → 403 if insufficient
  │
  ▼
  Controller (with TenantContext available via @Req())
```

### Tenant Context Propagation

```
Middleware/Guard → sets req.tenantContext = { orgId, userId, role }
  │
  ├─ Controller: @Req() req → req.tenantContext
  │
  ├─ Service: injected via method parameter or @Inject()
  │
  └─ Repository: all queries append WHERE org_id = :orgId
```

### Module Dependencies

```
AuthModule
  ├── imports: JwtModule, PassportModule, TypeOrmModule.forFeature([...entities])
  ├── providers: AuthService, ApiKeyService, JwtStrategy, SeedService
  ├── controllers: AuthController, ApiKeyController, OrganizationController
  └── exports: JwtAuthGuard, ApiKeyAuthGuard, RolesGuard (→ GatewayModule 등에서 사용)
```

## Complexity Tracking

No constitution violations. MVP-appropriate complexity level maintained.

## Implementation Phases

### Phase 1: Entities & Types (libs/common)
- Auth type definitions (Role enum, JWT payload, TenantContext interface)
- Organization, Team, User, ApiKey TypeORM entities
- Barrel exports

### Phase 2: Guards & Middleware (libs/common)
- JwtAuthGuard (passport-jwt strategy)
- ApiKeyAuthGuard (custom SHA-256 lookup)
- RolesGuard + @Roles() decorator
- TenantContext middleware

### Phase 3: Auth Service & Controller (apps/api)
- AuthModule setup (JwtModule, PassportModule)
- AuthService (login, refresh, validate)
- AuthController (POST /auth/login, POST /auth/refresh)

### Phase 4: Organization & API Key Management (apps/api)
- OrganizationController (org/team/user CRUD)
- ApiKeyService & ApiKeyController (create/list/revoke)

### Phase 5: Integration & Seed
- GatewayModule에 AuthGuard 통합
- SeedService (demo data)
- app.module.ts에 AuthModule 등록
- .env.example 업데이트
