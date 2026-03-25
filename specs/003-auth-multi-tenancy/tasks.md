# Tasks: F003 — Auth & Multi-tenancy

**Input**: Design documents from `/specs/003-auth-multi-tenancy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Shared Auth Entities & Types (libs/common)

**Purpose**: TypeORM entities and type definitions for the auth domain, shared across all apps

- [x] T001 [P] [US1,US3] Create auth types — Role enum, JwtPayload interface, TenantContext interface — `libs/common/src/auth/auth.types.ts`
- [x] T002 [P] [US3] Create Organization entity with slug unique constraint — `libs/common/src/auth/organization.entity.ts`
- [x] T003 [P] [US3] Create Team entity with org_id FK, composite unique (org_id, slug) — `libs/common/src/auth/team.entity.ts`
- [x] T004 [P] [US2,US3] Create User entity with @BeforeInsert password hashing, role enum — `libs/common/src/auth/user.entity.ts`
- [x] T005 [P] [US1,US5] Create ApiKey entity with key_hash unique, scopes jsonb — `libs/common/src/auth/api-key.entity.ts`
- [x] T006 Create barrel export for auth entities and types — `libs/common/src/auth/index.ts`
- [x] T007 Export auth module from common library — update `libs/common/src/index.ts`

**Checkpoint**: All auth entities compile with strict TypeScript, correct column types and relationships

---

## Phase 2: Auth Guards & Decorators (libs/common)

**Purpose**: NestJS guards and decorators for authentication and authorization

- [x] T008 [P] [US1] Create ApiKeyAuthGuard — x-api-key header → SHA-256 hash → DB lookup → TenantContext — `libs/common/src/auth/api-key-auth.guard.ts`
- [x] T009 [P] [US2] Create JwtAuthGuard — passport-jwt strategy, extract JWT claims → TenantContext — `libs/common/src/auth/jwt-auth.guard.ts`
- [x] T010 [P] [US4] Create RolesGuard + @Roles() decorator — check user role against required roles — `libs/common/src/auth/roles.guard.ts` + `libs/common/src/auth/roles.decorator.ts`
- [x] T011 [US1,US2] Create TenantContext middleware — extract orgId from API Key or JWT, set on request — `libs/common/src/auth/tenant-context.middleware.ts`
- [x] T012 Update auth barrel export with guards and middleware — `libs/common/src/auth/index.ts`

**Checkpoint**: Guards can be imported and used in any NestJS module. Types are correct.

---

## Phase 3: Auth Service & Controller — US1 (API Key Auth) + US2 (JWT Login)

**Purpose**: Core authentication logic — login, refresh, API key validation

- [x] T013 Install dependencies — `npm install @nestjs/jwt @nestjs/passport passport-jwt bcryptjs` + `npm install -D @types/passport-jwt @types/bcryptjs`
- [x] T014 Create AuthModule with JwtModule, PassportModule, TypeOrmModule.forFeature — `apps/api/src/auth/auth.module.ts`
- [x] T015 Create JwtStrategy (passport-jwt) for token validation — `apps/api/src/auth/jwt.strategy.ts`
- [x] T016 [US2] Write AuthController unit tests FIRST — login success/failure, refresh rotation, profile — `apps/api/src/auth/auth.controller.spec.ts`
- [x] T017 [US2] Create AuthService — login (validate credentials, issue tokens), refresh (validate + rotate), hashRefreshToken — `apps/api/src/auth/auth.service.ts`
- [x] T018 [US2] Create AuthController — `POST /auth/login`, `POST /auth/refresh`, `GET /auth/profile` — `apps/api/src/auth/auth.controller.ts`

**Checkpoint**: Login → JWT tokens, Refresh → token rotation, Profile → user info. All tests pass.

---

## Phase 4: Organization/Team/User Management — US3 (Multi-tenant) + US4 (RBAC)

**Purpose**: Organization hierarchy CRUD with tenant isolation and role-based access

- [x] T019 [US3,US4] Write Organization/Team/User CRUD tests FIRST — admin access, member read, viewer read, cross-tenant block — `apps/api/src/auth/organization.controller.spec.ts`
- [x] T020 [US3] Create OrganizationController — `GET /organizations`, `GET /organizations/:id`, `POST /organizations` — `apps/api/src/auth/organization.controller.ts`
- [x] T021 [US3] Create TeamController or extend Organization — `GET /teams`, `POST /teams` — integrated in organization controller or separate
- [x] T022 [US3] Create UserController or extend Organization — `GET /users`, `POST /users` — integrated in organization controller or separate
- [x] T023 [US4] Apply @Roles('admin') decorator to mutation endpoints (POST /teams, POST /users, etc.)

**Checkpoint**: Organization/Team/User CRUD works. RBAC enforced (admin=all, member=read, viewer=read). Cross-tenant access blocked.

---

## Phase 5: API Key Management — US5 (API Key Lifecycle)

**Purpose**: API Key create, list, revoke with hash storage

- [x] T024 [US5] Write ApiKey tests FIRST — create returns raw key once, list shows prefix only, revoke works, scope enforcement — `apps/api/src/auth/api-key.controller.spec.ts`
- [x] T025 [US5] Create ApiKeyService — generateKey (aegis_ prefix + 32 bytes), hashKey (SHA-256), create, list, revoke — `apps/api/src/auth/api-key.service.ts`
- [x] T026 [US5] Create ApiKeyController — `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id` — `apps/api/src/auth/api-key.controller.ts`

**Checkpoint**: API Key lifecycle complete. Raw key returned once, hash stored, revoke works, scopes enforced.

---

## Phase 6: Integration & Seed

**Purpose**: Wire everything together, seed demo data, update Gateway

- [x] T027 Create SeedService — demo Organization, Teams, Users (admin/member/viewer), API Key — `apps/api/src/auth/seed.service.ts`
- [x] T028 Register AuthModule in AppModule — `apps/api/src/app.module.ts`
- [x] T029 Integrate ApiKeyAuthGuard into GatewayController — protect `POST /v1/chat/completions` — update `apps/api/src/gateway/gateway.controller.ts` + `apps/api/src/gateway/gateway.module.ts`
- [x] T030 Update .env.example with JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRATION, JWT_REFRESH_EXPIRATION — `.env.example`
- [x] T031 Update env validation with new JWT environment variables — `libs/common/src/config/env.validation.ts` + `libs/common/src/config/env.validation.spec.ts`
- [x] T032 Update package.json if needed, verify build passes — `npm run build && npm test`

**Checkpoint**: Server starts, seed data loads, login works, API key auth works on gateway, all tests pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Entities): No dependencies — start immediately
- **Phase 2** (Guards): Depends on Phase 1 (entity types needed)
- **Phase 3** (Auth Service): Depends on Phase 1 + 2 (entities + guards)
- **Phase 4** (Org CRUD): Depends on Phase 3 (auth module must exist)
- **Phase 5** (API Key): Depends on Phase 3 (auth module must exist), can parallel with Phase 4
- **Phase 6** (Integration): Depends on Phase 3 + 4 + 5 (all components ready)

### Parallel Opportunities

```
Phase 1: T001 || T002 || T003 || T004 || T005 (all entities in parallel)
Phase 2: T008 || T009 || T010 (guards in parallel)
Phase 4 || Phase 5 (can run in parallel after Phase 3)
```
