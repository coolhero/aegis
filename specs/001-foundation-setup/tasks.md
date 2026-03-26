# Tasks: F001 — Foundation Setup

**Input**: `/specs/001-foundation-setup/`의 설계 문서
**Prerequisites**: plan.md (필수), spec.md (유저 스토리에 필수), research.md, data-model.md, contracts/

**Status**: 모든 태스크 완료. F001은 완전히 구현됨.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (서로 다른 파일, 의존성 없음)
- **[Story]**: 이 태스크가 속하는 유저 스토리 (예: US1, US2, US3)
- 설명에 정확한 파일 경로 포함

---

## Phase 1: Setup (공유 인프라)

**Purpose**: 프로젝트 초기화, 모노레포 스캐폴딩, 의존성 구성

- [x] T001 [P] [US1] NestJS 모노레포 스캐폴딩 생성 — `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`
- [x] T002 [P] [US1] 모든 의존성을 포함한 `package.json` 구성 (`@nestjs/core`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `ioredis`, `class-validator`, `class-transformer`)
- [x] T003 [P] [US1] 모든 필수 환경 변수를 포함한 `.env.example` 생성
- [x] T004 [P] [US1] Node.js/NestJS 프로젝트용 `.gitignore` 생성

---

## Phase 2: Foundational (선행 필수 요소)

**Purpose**: 모든 유저 스토리가 의존하는 핵심 인프라 모듈

**CRITICAL**: 이 Phase가 완료될 때까지 유저 스토리 작업을 시작할 수 없음

- [x] T005 [US1] Docker Compose 파일 생성 — `docker-compose.yml` (postgres:16-alpine, redis:7-alpine, 헬스 체크, named volumes)
- [x] T006 [US1] class-validator를 사용한 환경 변수 유효성 검사 구현 — `libs/common/src/config/env.validation.ts`
- [x] T007 [US1] 검증된 환경변수를 포함한 ConfigModule 생성 — `libs/common/src/config/config.module.ts`
- [x] T008 [US1] DatabaseModule 생성 (TypeORM + PostgreSQL) — `libs/common/src/database/database.module.ts`
- [x] T009 [US1] graceful degradation을 포함한 RedisModule 생성 — `libs/common/src/redis/redis.module.ts`
- [x] T010 [US1] RedisService 생성 (연결 이벤트를 포함한 ioredis 래퍼) — `libs/common/src/redis/redis.service.ts`
- [x] T011 [US1] 모든 모듈을 import하는 루트 AppModule 생성 — `apps/api/src/app.module.ts`
- [x] T012 [US1] bootstrap main.ts 생성 — `apps/api/src/main.ts`

**Checkpoint**: `npm run start:dev`가 DB와 Redis 연결 상태로 성공적으로 부팅

---

## Phase 3: User Story 1 — One-Command Local Environment (Priority: P1)

**Goal**: 개발자가 최소한의 명령으로 전체 스택을 클론, 구성, 실행할 수 있음

**Independent Test**: `docker compose up -d && npm install && npm run start:dev` 후 `curl localhost:3000/health`가 200 반환

### Implementation for User Story 1

- [x] T013 [US1] 모든 공통 모듈의 barrel export를 위한 `libs/common/src/index.ts` 생성
- [x] T014 [US1] `package.json`에 TypeORM 마이그레이션 스크립트 구성 (`migration:generate`, `migration:run`, `migration:revert`, `migration:show`)
- [x] T015 [US1] `@libs/common` 경로 별칭을 포함한 `apps/api/tsconfig.app.json` 구성
- [x] T016 [US1] `libs/common/tsconfig.lib.json` 구성

**Checkpoint**: 전체 로컬 환경 작동 — US1 독립적으로 기능 및 테스트 가능

---

## Phase 4: User Story 2 — Health Monitoring (Priority: P2)

**Goal**: `GET /health` 엔드포인트가 DB와 Redis 상태를 개별적으로 보고하며, 올바른 HTTP 상태 코드를 반환

**Independent Test**: Redis를 중지하고, `GET /health`가 `"degraded"`를 반환하는지 확인. PostgreSQL을 중지하고, 503을 확인.

### Implementation for User Story 2

- [x] T017 [US2] HealthModule 생성 — `apps/api/src/health/health.module.ts`
- [x] T018 [US2] 구성요소 수준 체크를 포함한 HealthController 생성 — `apps/api/src/health/health.controller.ts`
- [x] T019 [US2] DB 헬스 체크 로직 구현 (TypeORM `query('SELECT 1')`)
- [x] T020 [US2] Redis 헬스 체크 로직 구현 (ioredis `ping()`)
- [x] T021 [US2] 상태 집계 로직 구현 (구성요소 상태에 따라 `ok` / `degraded` / `error`)
- [x] T022 [US2] HealthController 유닛 테스트 — `apps/api/src/health/health.controller.spec.ts`

**Checkpoint**: `GET /health`가 모든 구성요소 조합에 대해 올바른 상태를 반환 — US2 독립적으로 기능

---

## Phase 5: User Story 3 — Fail-Fast Environment Validation (Priority: P3)

**Goal**: 필수 환경 변수가 누락되거나 잘못된 경우 명확한 오류 메시지와 함께 앱 시작을 거부

**Independent Test**: `.env`에서 `DATABASE_HOST`를 제거하고, `npm run start:dev`를 실행하여, 실행 가능한 메시지와 함께 즉시 실패하는지 확인.

### Implementation for User Story 3

- [x] T023 [US3] `class-validator` 데코레이터를 포함한 `EnvironmentVariables` 클래스 구현 — `libs/common/src/config/env.validation.ts`
- [x] T024 [US3] `plainToInstance` + `validateSync`를 사용한 `validate()` 함수 구현 — `libs/common/src/config/env.validation.ts`
- [x] T025 [US3] `ConfigModule.forRoot({ validate })`에 유효성 검사 함수 연결 — `libs/common/src/config/config.module.ts`
- [x] T026 [US3] 환경 변수 유효성 검사 유닛 테스트 — `libs/common/src/config/env.validation.spec.ts`

**Checkpoint**: 잘못된/누락된 환경 변수가 시작 시 명확한 오류를 생성 — US3 독립적으로 기능

---

## Phase 6: User Story 4 — Common Error Handling (Priority: P4)

**Goal**: 모든 엔드포인트에서 일관된 구조화된 JSON 오류 응답 및 응답 엔벨로프

**Independent Test**: 존재하지 않는 엔드포인트를 호출하고, `{ statusCode, message, error }` 형식을 확인.

### Implementation for User Story 4

- [x] T027 [P] [US4] HttpExceptionFilter 생성 — `libs/common/src/filters/http-exception.filter.ts`
- [x] T028 [P] [US4] ResponseInterceptor 생성 — `libs/common/src/interceptors/response.interceptor.ts`
- [x] T029 [P] [US4] 구조화된 JSON LoggerService 생성 — `libs/common/src/logger/logger.service.ts`
- [x] T030 [US4] `apps/api/src/main.ts`에 필터, 인터셉터, 로거를 전역으로 등록
- [x] T031 [US4] `libs/common/src/index.ts`에서 모든 공통 모듈 export

**Checkpoint**: 모든 오류 응답이 표준 형식 사용, 모든 응답이 래핑됨 — US4 독립적으로 기능

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서화, 검증, 최종 정리

- [x] T032 [P] 문서화된 변수와 기본값을 포함한 `.env.example` 생성
- [x] T033 [P] `npm run build`가 오류 없이 성공하는지 확인
- [x] T034 quickstart.md 유효성 검증 실행 (처음부터 전체 설정)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1에 의존 — 모든 유저 스토리를 차단(BLOCKS)
- **US1 (Phase 3)**: Phase 2에 의존 — 핵심 로컬 환경
- **US2 (Phase 4)**: Phase 2 + Phase 2의 RedisService에 의존
- **US3 (Phase 5)**: Phase 2에 의존 — 환경 변수 유효성 검사 연결
- **US4 (Phase 6)**: Phase 2에 의존 — 필터/인터셉터 등록
- **Polish (Phase 7)**: 모든 유저 스토리 Phase에 의존

### User Story Dependencies

- **User Story 1 (P1)**: 기반만 필요 — 교차 스토리 의존성 없음
- **User Story 2 (P2)**: Phase 2의 RedisService (T010)와 DatabaseModule (T008) 필요
- **User Story 3 (P3)**: Phase 2의 ConfigModule (T007) 필요
- **User Story 4 (P4)**: 다른 스토리와 독립적, Phase 2에만 의존

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 — 모두 병렬 (서로 다른 파일)
- Phase 6: T027, T028, T029 — 모두 병렬 (libs/common 내 서로 다른 파일)
- US2, US3, US4는 Phase 2 완료 후 병렬 실행 가능
