# Tasks: F001 — Foundation Setup

**Input**: Design documents from `/specs/001-foundation-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Status**: All tasks completed. F001 is fully implemented.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, monorepo scaffolding, dependency configuration

- [x] T001 [P] [US1] Create NestJS monorepo scaffolding — `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`
- [x] T002 [P] [US1] Configure `package.json` with all dependencies (`@nestjs/core`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `ioredis`, `class-validator`, `class-transformer`)
- [x] T003 [P] [US1] Create `.env.example` with all required environment variables
- [x] T004 [P] [US1] Create `.gitignore` for Node.js/NestJS project

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure modules that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [US1] Create Docker Compose file — `docker-compose.yml` (postgres:16-alpine, redis:7-alpine with health checks, named volumes)
- [x] T006 [US1] Implement environment validation with class-validator — `libs/common/src/config/env.validation.ts`
- [x] T007 [US1] Create ConfigModule with validated env — `libs/common/src/config/config.module.ts`
- [x] T008 [US1] Create DatabaseModule (TypeORM + PostgreSQL) — `libs/common/src/database/database.module.ts`
- [x] T009 [US1] Create RedisModule with graceful degradation — `libs/common/src/redis/redis.module.ts`
- [x] T010 [US1] Create RedisService (ioredis wrapper with connection events) — `libs/common/src/redis/redis.service.ts`
- [x] T011 [US1] Create root AppModule importing all modules — `apps/api/src/app.module.ts`
- [x] T012 [US1] Create bootstrap main.ts — `apps/api/src/main.ts`

**Checkpoint**: `npm run start:dev` boots successfully with DB and Redis connected

---

## Phase 3: User Story 1 — One-Command Local Environment (Priority: P1)

**Goal**: Developer can clone, configure, and run the full stack with minimal commands

**Independent Test**: `docker compose up -d && npm install && npm run start:dev` then `curl localhost:3000/health` returns 200

### Implementation for User Story 1

- [x] T013 [US1] Create `libs/common/src/index.ts` barrel export for all common modules
- [x] T014 [US1] Configure TypeORM migration scripts in `package.json` (`migration:generate`, `migration:run`, `migration:revert`, `migration:show`)
- [x] T015 [US1] Configure `apps/api/tsconfig.app.json` with path aliases for `@libs/common`
- [x] T016 [US1] Configure `libs/common/tsconfig.lib.json`

**Checkpoint**: Full local environment operational — US1 independently functional and testable

---

## Phase 4: User Story 2 — Health Monitoring (Priority: P2)

**Goal**: `GET /health` endpoint reports DB and Redis status individually, with correct HTTP status codes

**Independent Test**: Stop Redis, verify `GET /health` returns `"degraded"`. Stop PostgreSQL, verify 503.

### Implementation for User Story 2

- [x] T017 [US2] Create HealthModule — `apps/api/src/health/health.module.ts`
- [x] T018 [US2] Create HealthController with component-level checks — `apps/api/src/health/health.controller.ts`
- [x] T019 [US2] Implement DB health check logic (TypeORM `query('SELECT 1')`)
- [x] T020 [US2] Implement Redis health check logic (ioredis `ping()`)
- [x] T021 [US2] Implement status aggregation logic (`ok` / `degraded` / `error` based on component states)
- [x] T022 [US2] Unit test for HealthController — `apps/api/src/health/health.controller.spec.ts`

**Checkpoint**: `GET /health` returns correct status for all component combinations — US2 independently functional

---

## Phase 5: User Story 3 — Fail-Fast Environment Validation (Priority: P3)

**Goal**: App refuses to start with clear error messages when required env vars are missing or invalid

**Independent Test**: Remove `DATABASE_HOST` from `.env`, run `npm run start:dev`, verify immediate failure with actionable message.

### Implementation for User Story 3

- [x] T023 [US3] Implement `EnvironmentVariables` class with `class-validator` decorators — `libs/common/src/config/env.validation.ts`
- [x] T024 [US3] Implement `validate()` function using `plainToInstance` + `validateSync` — `libs/common/src/config/env.validation.ts`
- [x] T025 [US3] Wire validation function into `ConfigModule.forRoot({ validate })` — `libs/common/src/config/config.module.ts`
- [x] T026 [US3] Unit test for env validation — `libs/common/src/config/env.validation.spec.ts`

**Checkpoint**: Invalid/missing env vars produce clear error at startup — US3 independently functional

---

## Phase 6: User Story 4 — Common Error Handling (Priority: P4)

**Goal**: Consistent structured JSON error responses and response envelope across all endpoints

**Independent Test**: Call non-existent endpoint, verify `{ statusCode, message, error }` format.

### Implementation for User Story 4

- [x] T027 [P] [US4] Create HttpExceptionFilter — `libs/common/src/filters/http-exception.filter.ts`
- [x] T028 [P] [US4] Create ResponseInterceptor — `libs/common/src/interceptors/response.interceptor.ts`
- [x] T029 [P] [US4] Create structured JSON LoggerService — `libs/common/src/logger/logger.service.ts`
- [x] T030 [US4] Register filter, interceptor, and logger globally in `apps/api/src/main.ts`
- [x] T031 [US4] Export all common modules from `libs/common/src/index.ts`

**Checkpoint**: All error responses use standard format, all responses wrapped — US4 independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification, final cleanup

- [x] T032 [P] Create `.env.example` with documented variables and default values
- [x] T033 [P] Verify `npm run build` succeeds without errors
- [x] T034 Run quickstart.md validation (full setup from scratch)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core local environment
- **US2 (Phase 4)**: Depends on Phase 2 + RedisService from Phase 2
- **US3 (Phase 5)**: Depends on Phase 2 — env validation wiring
- **US4 (Phase 6)**: Depends on Phase 2 — filter/interceptor registration
- **Polish (Phase 7)**: Depends on all user story phases

### User Story Dependencies

- **User Story 1 (P1)**: Foundation only — no cross-story dependencies
- **User Story 2 (P2)**: Requires RedisService (T010) and DatabaseModule (T008) from Phase 2
- **User Story 3 (P3)**: Requires ConfigModule (T007) from Phase 2
- **User Story 4 (P4)**: Independent of other stories, depends only on Phase 2

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 — all parallel (different files)
- Phase 6: T027, T028, T029 — all parallel (different files in libs/common)
- US2, US3, US4 can run in parallel after Phase 2 is complete
