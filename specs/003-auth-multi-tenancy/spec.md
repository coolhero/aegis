# Feature Specification: F003 — Auth & Multi-tenancy

**Feature Branch**: `003-auth-multi-tenancy`
**Created**: 2025-03-25
**Status**: Draft
**Input**: API Key 인증과 JWT 대시보드 세션, Organization > Team > User 계층 구조 기반 멀티테넌시, RBAC 권한 관리

## User Scenarios & Testing *(mandatory)*

### User Story 1 — API Key Authentication (Priority: P1)

외부 클라이언트 개발자가 API Key를 발급받아 `x-api-key` 헤더로 LLM Gateway(`POST /v1/chat/completions`)에 요청을 보낸다. 게이트웨이는 Key를 검증하고, Key에 연결된 Organization을 식별하여 TenantContext를 설정한 후 요청을 처리한다. 무효하거나 폐기된 Key로 요청하면 즉시 401 응답을 받는다.

**Why this priority**: API Key 인증 없이는 LLM Gateway를 안전하게 사용할 수 없다. 모든 외부 API 호출의 진입점.

**Independent Test**: API Key를 생성하고, 해당 Key로 `POST /v1/chat/completions` 요청 시 200 응답 확인. 잘못된 Key로 요청 시 401 확인.

**Acceptance Scenarios**:

1. **Given** 유효한 API Key가 발급된 상태, **When** 클라이언트가 `x-api-key: <valid-key>` 헤더로 `POST /v1/chat/completions` 요청, **Then** 200 OK 응답 + TenantContext에 해당 Organization 정보 설정.
2. **Given** 유효하지 않은 API Key, **When** `x-api-key: <invalid-key>` 헤더로 요청, **Then** 401 Unauthorized 응답 + `{ "error": "Invalid API key" }`.
3. **Given** 폐기(revoked)된 API Key, **When** 해당 Key로 요청, **Then** 401 Unauthorized 응답.
4. **Given** `x-api-key` 헤더 없이 보호된 엔드포인트 요청, **When** 인증 없이 접근, **Then** 401 Unauthorized 응답.
5. **Given** 유효한 API Key, **When** 요청 성공, **Then** ApiKey의 `last_used_at` 타임스탬프가 갱신됨.

---

### User Story 2 — JWT Dashboard Login (Priority: P1)

대시보드 사용자(관리자, 팀 리더)가 이메일과 비밀번호로 `POST /auth/login`에 로그인하면 Access Token과 Refresh Token을 받는다. Access Token으로 대시보드 API에 접근하며, 만료 시 Refresh Token으로 새 토큰 쌍을 발급받는다. Refresh Token Rotation이 적용되어 사용된 Refresh Token은 즉시 무효화된다.

**Why this priority**: 대시보드 관리 기능의 기반. API Key와 함께 이중 인증 체계의 한 축.

**Independent Test**: 이메일/패스워드로 로그인 → JWT 토큰 수신 → 토큰으로 보호 API 접근 → Refresh → 새 토큰 수신.

**Acceptance Scenarios**:

1. **Given** 등록된 사용자, **When** 올바른 이메일+비밀번호로 `POST /auth/login`, **Then** `{ "accessToken": "...", "refreshToken": "..." }` 반환, Access Token에 userId, orgId, role claim 포함.
2. **Given** 잘못된 비밀번호, **When** `POST /auth/login`, **Then** 401 Unauthorized + `{ "error": "Invalid credentials" }`.
3. **Given** 유효한 Access Token, **When** `Authorization: Bearer <token>` 헤더로 보호 API 접근, **Then** 요청 성공 + TenantContext 설정.
4. **Given** 만료된 Access Token, **When** 보호 API 접근, **Then** 401 Unauthorized.
5. **Given** 유효한 Refresh Token, **When** `POST /auth/refresh` with `{ "refreshToken": "..." }`, **Then** 새 Access Token + 새 Refresh Token 반환 + 기존 Refresh Token 무효화.
6. **Given** 이미 사용된(무효화된) Refresh Token, **When** `POST /auth/refresh`, **Then** 401 Unauthorized (Refresh Token Rotation 위반 감지).

---

### User Story 3 — Multi-tenant Organization Management (Priority: P2)

조직 관리자(Org Admin)가 Organization을 관리하고, 그 아래 Team과 User를 생성/조회한다. 각 Organization은 완전히 격리되어, 한 Organization의 관리자가 다른 Organization의 데이터에 접근할 수 없다.

**Why this priority**: 멀티테넌트 구조의 핵심. 예산 관리(F004), 로깅(F005) 등 후속 Feature의 기반.

**Independent Test**: Organization A에서 Team과 User 생성 → Organization B로 전환 → A의 데이터 접근 불가 확인.

**Acceptance Scenarios**:

1. **Given** admin 역할의 사용자, **When** `POST /organizations` with `{ "name": "Acme Corp", "slug": "acme" }`, **Then** 201 Created + Organization 생성.
2. **Given** Organization A의 admin, **When** `GET /organizations/:orgAId/teams`, **Then** Organization A의 팀 목록만 반환.
3. **Given** Organization A의 admin, **When** Organization B의 `GET /organizations/:orgBId/teams` 시도, **Then** 403 Forbidden.
4. **Given** admin 역할, **When** `POST /teams` with `{ "name": "Backend", "orgId": "..." }`, **Then** 201 Created + Team 생성.
5. **Given** admin 역할, **When** `POST /users` with `{ "email": "dev@acme.com", "name": "Dev", "role": "member", "teamId": "..." }`, **Then** 201 Created + User 생성.

---

### User Story 4 — RBAC Role-based Access Control (Priority: P2)

시스템은 admin, member, viewer 세 가지 역할을 지원한다. 각 역할은 허용된 작업만 수행할 수 있으며, 권한이 없는 작업은 403 Forbidden을 반환한다.

**Why this priority**: 세분화된 접근 제어로 보안 강화. 엔터프라이즈 환경의 필수 요구사항.

**Independent Test**: admin으로 모든 작업 성공 → member로 관리 작업 시도 → 403 확인 → viewer로 쓰기 작업 시도 → 403 확인.

**Acceptance Scenarios**:

1. **Given** admin 역할, **When** 사용자/팀/API Key 관리 API 호출, **Then** 모든 CRUD 작업 성공.
2. **Given** member 역할, **When** 데이터 조회 + LLM API 호출, **Then** 성공.
3. **Given** member 역할, **When** 사용자/팀 생성/삭제 등 관리 작업 시도, **Then** 403 Forbidden.
4. **Given** viewer 역할, **When** 데이터 조회만, **Then** 성공.
5. **Given** viewer 역할, **When** LLM API 호출 또는 쓰기 작업 시도, **Then** 403 Forbidden.

---

### User Story 5 — API Key Lifecycle Management (Priority: P3)

관리자가 API Key를 생성, 조회, 폐기(revoke)한다. 생성 시 권한 범위(model scope)와 만료일을 설정할 수 있다. Key 원본은 생성 시 1회만 표시되며, DB에는 해시만 저장된다. 폐기된 Key는 즉시 인증 불가.

**Why this priority**: API Key의 전체 수명 주기 관리. 보안 운영에 필수.

**Independent Test**: Key 생성 → 원본 확인 → 목록 조회(마스킹) → Key 사용 → 폐기 → 사용 실패.

**Acceptance Scenarios**:

1. **Given** admin 역할, **When** `POST /api-keys` with `{ "name": "prod-key", "scopes": ["gpt-4o"], "expiresAt": "2025-12-31" }`, **Then** 201 Created + `{ "key": "aegis_...", "id": "..." }` 원본 key 1회 반환.
2. **Given** 생성된 API Key, **When** DB에서 해당 레코드 조회, **Then** `key_hash` 필드만 존재, 평문 key 없음.
3. **Given** admin 역할, **When** `GET /api-keys`, **Then** Key 목록 반환 (마스킹된 prefix만 표시, 예: `aegis_...abc`).
4. **Given** admin 역할, **When** `DELETE /api-keys/:id` (revoke), **Then** 200 OK + Key의 `revoked` 필드 true.
5. **Given** scopes에 `["gpt-4o"]`만 설정된 Key, **When** `model: "claude-sonnet-4-20250514"` 요청, **Then** 403 Forbidden (모델 범위 초과).
6. **Given** 만료일이 지난 Key, **When** 해당 Key로 인증 시도, **Then** 401 Unauthorized.

---

### Edge Cases

- 동시에 같은 Refresh Token으로 여러 요청이 들어올 때의 race condition 처리
- API Key 해시 충돌 방지 (충분히 긴 key + SHA-256)
- Organization slug 중복 시 409 Conflict 반환
- 비밀번호 해싱에 bcrypt 사용, timing attack 방지
- 삭제된 Organization 소속 API Key 자동 무효화
- Tenant Context 결정 실패 시 (orphaned key 등) 요청 거부

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `x-api-key` 헤더를 통한 API Key 인증을 지원해야 한다. Key 검증 후 연결된 Organization의 TenantContext를 설정한다.
- **FR-002**: 시스템은 이메일/비밀번호 기반 JWT 로그인(`POST /auth/login`)을 지원해야 한다. Access Token(15분)과 Refresh Token(7일)을 발급한다.
- **FR-003**: 시스템은 Refresh Token Rotation을 구현해야 한다. `POST /auth/refresh` 시 새 토큰 쌍 발급 + 기존 Refresh Token 무효화.
- **FR-004**: 시스템은 Organization > Team > User 계층 구조를 지원해야 한다. 각 엔티티의 CRUD API를 제공한다.
- **FR-005**: 시스템은 RBAC(admin/member/viewer) 역할 기반 접근 제어를 구현해야 한다. 역할별 허용 작업 매트릭스에 따라 접근을 제어한다.
- **FR-006**: 시스템은 API Key의 생성, 조회, 폐기(revoke) 기능을 제공해야 한다. 생성 시 권한 범위(model scopes)와 만료일을 설정할 수 있다.
- **FR-007**: API Key는 해시(SHA-256)로만 저장되어야 한다. 원본 key는 생성 시 1회만 반환되며, 이후 조회 불가.
- **FR-008**: 모든 인증된 요청에 TenantContext 미들웨어가 적용되어야 한다. 게이트웨이 엣지에서 테넌트를 식별하고 모든 레이어에 전파한다.
- **FR-009**: 모든 데이터 쿼리에 tenant_id 기반 필터가 적용되어야 한다. Cross-tenant 데이터 접근이 불가능해야 한다.
- **FR-010**: 개발/데모용 seed 데이터(Organization, Team, User, API Key)를 제공해야 한다.

### RBAC Permission Matrix

| Action | admin | member | viewer |
|--------|-------|--------|--------|
| 조직/팀/사용자 관리 (CRUD) | ✅ | ❌ | ❌ |
| API Key 관리 (생성/폐기) | ✅ | ❌ | ❌ |
| LLM API 호출 | ✅ | ✅ | ❌ |
| 데이터 조회 (로그, 사용량) | ✅ | ✅ | ✅ |
| 예산 설정/수정 | ✅ | ❌ | ❌ |
| 자신의 프로필 조회/수정 | ✅ | ✅ | ✅ |

### Key Entities

- **Organization**: 최상위 테넌트 단위. name, slug(unique), plan, settings 포함.
- **Team**: Organization 하위 그룹. name, slug, org_id 참조.
- **User**: 시스템 사용자. email(unique), name, password_hash, role(admin/member/viewer), org_id, team_id 참조.
- **ApiKey**: API 인증 키. key_hash(SHA-256), name, scopes(JSON), expires_at, revoked, org_id, user_id 참조.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 유효한 API Key로 인증 시 요청 성공(200) + TenantContext 설정. 무효/폐기된 Key → 401.
- **SC-002**: 올바른 이메일+비밀번호로 로그인 시 Access Token + Refresh Token 발급. 잘못된 자격증명 → 401.
- **SC-003**: Refresh Token으로 토큰 갱신 시 새 토큰 쌍 발급 + 기존 Refresh Token 무효화. 재사용된 Refresh Token → 401.
- **SC-004**: Organization, Team, User CRUD 동작 확인. admin만 생성/수정/삭제 가능.
- **SC-005**: admin은 모든 작업, member는 조회+LLM 호출, viewer는 조회 전용. 권한 없는 작업 → 403.
- **SC-006**: API Key 생성 시 원본 1회 반환, DB에 해시만 저장. 폐기 후 인증 → 401. 만료된 Key → 401.
- **SC-007**: Tenant A의 데이터가 Tenant B에게 절대 노출되지 않음. Cross-tenant 접근 시도 → 403.
- **SC-008**: TenantContext가 Controller → Service → Repository 전 레이어에서 동일하게 전파됨.
- **SC-009**: API Key의 model scopes를 벗어난 모델 요청 → 403 Forbidden.
- **SC-010**: Seed 데이터 실행 후 기본 Organization, Team, User, API Key가 생성되어 즉시 데모 가능.

## Assumptions

- Access Token 만료: 15분, Refresh Token 만료: 7일 (환경변수로 설정 가능)
- 비밀번호 해싱: bcrypt (cost factor 10)
- API Key 형식: `aegis_` prefix + 32바이트 랜덤 문자열
- 테넌트 격리: Row-Level (shared table + tenant_id column) 방식. DB-per-tenant은 MVP 범위 밖.
- 사용자 자가 회원가입(self-signup)은 MVP 범위 밖. admin이 사용자를 직접 생성.
- OAuth/SSO 연동은 후속 Feature에서 처리.
