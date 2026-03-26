# Implementation Plan: F003 — Auth & Multi-tenancy

**Branch**: `003-auth-multi-tenancy` | **Date**: 2025-03-25 | **Spec**: [spec.md](spec.md)
**Input**: `/specs/003-auth-multi-tenancy/spec.md`의 Feature 명세

## Summary

API Key 인증과 JWT 세션 관리를 구현하고, Organization > Team > User 계층 구조 기반 멀티테넌시 + RBAC를 제공한다. NestJS Guard/Middleware 패턴으로 전 Feature에 인증/인가 기반을 확립한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, @nestjs/jwt, @nestjs/passport, passport-jwt, bcryptjs
**Storage**: PostgreSQL (TypeORM), Redis (세션/캐시 향후)
**Testing**: Jest + Supertest
**Target Platform**: Linux server (Docker)
**Project Type**: 웹 서비스 (API gateway)
**Constraints**: MVP 범위 — Row-Level tenant isolation, 사용자당 단일 Refresh Token

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Tenant Data Isolation | ✅ Pass | org_id 기반 Row-Level isolation, 모든 쿼리에 tenant 필터 |
| Secure Token Storage | ✅ Pass | API Key: SHA-256, Password: bcrypt, Refresh Token: SHA-256 |
| Start Simple (YAGNI) | ✅ Pass | 단일 refresh token, shared table, custom guard |
| Audit Trail | ⏩ Deferred | F005에서 처리 |
| Contract Testing | ⏩ Deferred | 외부 API 없음 (내부 인증만) |

## Project Structure

### Documentation (이 Feature)

```text
specs/003-auth-multi-tenancy/
├── plan.md              # 이 파일
├── research.md          # Phase 0 산출물
├── data-model.md        # Phase 1 산출물
├── quickstart.md        # Phase 1 산출물
├── contracts/           # Phase 1 산출물
│   ├── auth.contract.md
│   ├── organizations.contract.md
│   └── api-keys.contract.md
└── tasks.md             # Phase 2 산출물
```

### Source Code

```text
libs/common/src/auth/
├── index.ts                      # Barrel export
├── auth.types.ts                 # Role enum, JwtPayload, TenantContext 인터페이스
├── organization.entity.ts        # Organization TypeORM 엔티티
├── team.entity.ts                # Team TypeORM 엔티티
├── user.entity.ts                # User TypeORM 엔티티 (@BeforeInsert 해시 포함)
├── api-key.entity.ts             # ApiKey TypeORM 엔티티
├── jwt-auth.guard.ts             # JWT Bearer Guard
├── api-key-auth.guard.ts         # x-api-key Guard
├── roles.guard.ts                # RBAC Roles Guard
├── roles.decorator.ts            # @Roles() 데코레이터
└── tenant-context.middleware.ts  # TenantContext 추출 미들웨어

apps/api/src/auth/
├── auth.module.ts                # NestJS AuthModule
├── auth.service.ts               # 로그인, refresh, 토큰 로직
├── auth.controller.ts            # POST /auth/login, /auth/refresh
├── auth.controller.spec.ts       # Controller 유닛 테스트
├── api-key.service.ts            # API Key CRUD
├── api-key.controller.ts         # API Key 엔드포인트
├── organization.controller.ts    # Organization/Team/User CRUD
└── seed.service.ts               # 데모 seed 데이터
```

## Architecture

### Authentication Flow

```
클라이언트 요청
  │
  ├─ x-api-key 헤더? ──→ ApiKeyGuard ──→ SHA-256 해시 → DB 조회
  │                                         → TenantContext(orgId)
  │
  └─ Authorization: Bearer? ──→ JwtAuthGuard ──→ passport-jwt 검증
                                                  → TenantContext(JWT claim의 orgId)
  │
  └─ 둘 다 없음? ──→ 401 Unauthorized
  │
  ▼
  RolesGuard ──→ @Roles() 데코레이터 확인 → 권한 부족 시 403
  │
  ▼
  Controller (TenantContext를 @Req()를 통해 사용 가능)
```

### Tenant Context Propagation

```
Middleware/Guard → req.tenantContext = { orgId, userId, role } 설정
  │
  ├─ Controller: @Req() req → req.tenantContext
  │
  ├─ Service: 메서드 파라미터 또는 @Inject()를 통해 주입
  │
  └─ Repository: 모든 쿼리에 WHERE org_id = :orgId 추가
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

헌법(constitution) 위반 사항 없음. MVP에 적합한 복잡도 수준 유지.

## Implementation Phases

### Phase 1: 엔티티 & 타입 (libs/common)
- Auth 타입 정의 (Role enum, JWT payload, TenantContext 인터페이스)
- Organization, Team, User, ApiKey TypeORM 엔티티
- Barrel exports

### Phase 2: Guards & Middleware (libs/common)
- JwtAuthGuard (passport-jwt strategy)
- ApiKeyAuthGuard (커스텀 SHA-256 조회)
- RolesGuard + @Roles() 데코레이터
- TenantContext 미들웨어

### Phase 3: Auth Service & Controller (apps/api)
- AuthModule 설정 (JwtModule, PassportModule)
- AuthService (로그인, refresh, 검증)
- AuthController (POST /auth/login, POST /auth/refresh)

### Phase 4: Organization & API Key 관리 (apps/api)
- OrganizationController (org/team/user CRUD)
- ApiKeyService & ApiKeyController (생성/목록/폐기)

### Phase 5: 통합 & Seed
- GatewayModule에 AuthGuard 통합
- SeedService (데모 데이터)
- app.module.ts에 AuthModule 등록
- .env.example 업데이트
