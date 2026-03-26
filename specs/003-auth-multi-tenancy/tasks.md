# Tasks: F003 — Auth & Multi-tenancy

**Input**: `/specs/003-auth-multi-tenancy/`의 설계 문서
**Prerequisites**: plan.md (필수), spec.md (유저 스토리에 필수), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (서로 다른 파일, 의존성 없음)
- **[Story]**: 이 작업이 속한 유저 스토리 (예: US1, US2, US3, US4, US5)
- 설명에 정확한 파일 경로 포함

---

## Phase 1: 공유 Auth 엔티티 & 타입 (libs/common)

**Purpose**: Auth 도메인의 TypeORM 엔티티 및 타입 정의, 모든 앱에서 공유

- [x] T001 [P] [US1,US3] Auth 타입 생성 — Role enum, JwtPayload 인터페이스, TenantContext 인터페이스 — `libs/common/src/auth/auth.types.ts`
- [x] T002 [P] [US3] Organization 엔티티 생성, slug unique 제약조건 — `libs/common/src/auth/organization.entity.ts`
- [x] T003 [P] [US3] Team 엔티티 생성, org_id FK, composite unique (org_id, slug) — `libs/common/src/auth/team.entity.ts`
- [x] T004 [P] [US2,US3] User 엔티티 생성, @BeforeInsert 비밀번호 해싱, role enum — `libs/common/src/auth/user.entity.ts`
- [x] T005 [P] [US1,US5] ApiKey 엔티티 생성, key_hash unique, scopes jsonb — `libs/common/src/auth/api-key.entity.ts`
- [x] T006 Auth 엔티티 및 타입의 barrel export 생성 — `libs/common/src/auth/index.ts`
- [x] T007 common 라이브러리에서 auth 모듈 export — `libs/common/src/index.ts` 업데이트

**Checkpoint**: 모든 auth 엔티티가 strict TypeScript로 컴파일, 올바른 컬럼 타입 및 관계 설정 확인

---

## Phase 2: Auth Guards & Decorators (libs/common)

**Purpose**: 인증 및 인가를 위한 NestJS guards와 데코레이터

- [x] T008 [P] [US1] ApiKeyAuthGuard 생성 — x-api-key 헤더 → SHA-256 해시 → DB 조회 → TenantContext — `libs/common/src/auth/api-key-auth.guard.ts`
- [x] T009 [P] [US2] JwtAuthGuard 생성 — passport-jwt strategy, JWT claims 추출 → TenantContext — `libs/common/src/auth/jwt-auth.guard.ts`
- [x] T010 [P] [US4] RolesGuard + @Roles() 데코레이터 생성 — 사용자 역할과 필수 역할 비교 — `libs/common/src/auth/roles.guard.ts` + `libs/common/src/auth/roles.decorator.ts`
- [x] T011 [US1,US2] TenantContext 미들웨어 생성 — API Key 또는 JWT에서 orgId 추출, 요청에 설정 — `libs/common/src/auth/tenant-context.middleware.ts`
- [x] T012 Auth barrel export에 guards와 middleware 업데이트 — `libs/common/src/auth/index.ts`

**Checkpoint**: Guards를 모든 NestJS 모듈에서 import하여 사용 가능. 타입 정확성 확인.

---

## Phase 3: Auth Service & Controller — US1 (API Key Auth) + US2 (JWT Login)

**Purpose**: 핵심 인증 로직 — 로그인, refresh, API key 검증

- [x] T013 의존성 설치 — `npm install @nestjs/jwt @nestjs/passport passport-jwt bcryptjs` + `npm install -D @types/passport-jwt @types/bcryptjs`
- [x] T014 AuthModule 생성, JwtModule, PassportModule, TypeOrmModule.forFeature 포함 — `apps/api/src/auth/auth.module.ts`
- [x] T015 JwtStrategy (passport-jwt) 토큰 검증용 생성 — `apps/api/src/auth/jwt.strategy.ts`
- [x] T016 [US2] AuthController 유닛 테스트 먼저 작성 — 로그인 성공/실패, refresh rotation, 프로필 — `apps/api/src/auth/auth.controller.spec.ts`
- [x] T017 [US2] AuthService 생성 — 로그인 (자격증명 검증, 토큰 발급), refresh (검증 + rotation), hashRefreshToken — `apps/api/src/auth/auth.service.ts`
- [x] T018 [US2] AuthController 생성 — `POST /auth/login`, `POST /auth/refresh`, `GET /auth/profile` — `apps/api/src/auth/auth.controller.ts`

**Checkpoint**: 로그인 → JWT 토큰 발급, Refresh → 토큰 rotation, Profile → 사용자 정보. 모든 테스트 통과.

---

## Phase 4: Organization/Team/User 관리 — US3 (Multi-tenant) + US4 (RBAC)

**Purpose**: 테넌트 격리와 역할 기반 접근 제어를 갖춘 Organization 계층 CRUD

- [x] T019 [US3,US4] Organization/Team/User CRUD 테스트 먼저 작성 — admin 접근, member 조회, viewer 조회, cross-tenant 차단 — `apps/api/src/auth/organization.controller.spec.ts`
- [x] T020 [US3] OrganizationController 생성 — `GET /organizations`, `GET /organizations/:id`, `POST /organizations` — `apps/api/src/auth/organization.controller.ts`
- [x] T021 [US3] TeamController 생성 또는 Organization 확장 — `GET /teams`, `POST /teams` — organization controller에 통합 또는 별도 분리
- [x] T022 [US3] UserController 생성 또는 Organization 확장 — `GET /users`, `POST /users` — organization controller에 통합 또는 별도 분리
- [x] T023 [US4] 변경(mutation) 엔드포인트에 @Roles('admin') 데코레이터 적용 (POST /teams, POST /users 등)

**Checkpoint**: Organization/Team/User CRUD 동작. RBAC 적용 (admin=전체, member=조회, viewer=조회). Cross-tenant 접근 차단.

---

## Phase 5: API Key 관리 — US5 (API Key Lifecycle)

**Purpose**: API Key 생성, 목록, 폐기 및 해시 저장

- [x] T024 [US5] ApiKey 테스트 먼저 작성 — 생성 시 원본 key 1회 반환, 목록에서 prefix만 표시, 폐기 동작, scope 적용 — `apps/api/src/auth/api-key.controller.spec.ts`
- [x] T025 [US5] ApiKeyService 생성 — generateKey (aegis_ prefix + 32 bytes), hashKey (SHA-256), 생성, 목록, 폐기 — `apps/api/src/auth/api-key.service.ts`
- [x] T026 [US5] ApiKeyController 생성 — `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id` — `apps/api/src/auth/api-key.controller.ts`

**Checkpoint**: API Key 수명 주기 완료. 원본 key 1회 반환, 해시 저장, 폐기 동작, scopes 적용.

---

## Phase 6: 통합 & Seed

**Purpose**: 모든 것을 연결, 데모 데이터 seed, Gateway 업데이트

- [x] T027 SeedService 생성 — 데모 Organization, Teams, Users (admin/member/viewer), API Key — `apps/api/src/auth/seed.service.ts`
- [x] T028 AppModule에 AuthModule 등록 — `apps/api/src/app.module.ts`
- [x] T029 GatewayController에 ApiKeyAuthGuard 통합 — `POST /v1/chat/completions` 보호 — `apps/api/src/gateway/gateway.controller.ts` + `apps/api/src/gateway/gateway.module.ts` 업데이트
- [x] T030 .env.example에 JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRATION, JWT_REFRESH_EXPIRATION 업데이트 — `.env.example`
- [x] T031 새 JWT 환경변수에 대한 env 유효성 검사 업데이트 — `libs/common/src/config/env.validation.ts` + `libs/common/src/config/env.validation.spec.ts`
- [x] T032 필요 시 package.json 업데이트, 빌드 통과 확인 — `npm run build && npm test`

**Checkpoint**: 서버 시작, seed 데이터 로드, 로그인 동작, gateway에서 API key 인증 동작, 모든 테스트 통과.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (엔티티): 의존성 없음 — 즉시 시작
- **Phase 2** (Guards): Phase 1에 의존 (엔티티 타입 필요)
- **Phase 3** (Auth Service): Phase 1 + 2에 의존 (엔티티 + guards)
- **Phase 4** (Org CRUD): Phase 3에 의존 (auth 모듈 필요)
- **Phase 5** (API Key): Phase 3에 의존 (auth 모듈 필요), Phase 4와 병렬 가능
- **Phase 6** (통합): Phase 3 + 4 + 5에 의존 (모든 컴포넌트 준비)

### Parallel Opportunities

```
Phase 1: T001 || T002 || T003 || T004 || T005 (모든 엔티티 병렬)
Phase 2: T008 || T009 || T010 (guards 병렬)
Phase 4 || Phase 5 (Phase 3 완료 후 병렬 실행 가능)
```
