# Research: F003 — Auth & Multi-tenancy

**Feature**: F003 — Auth & Multi-tenancy
**Date**: 2025-03-25
**Phase**: 0 (Research)

## Key Technical Decisions

### 1. JWT Strategy

**Decision**: Access Token (15min) + Refresh Token (7일) with Rotation

- **Library**: `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`
- Access Token: stateless, short-lived, JWT_SECRET 서명
- Refresh Token: DB 저장, 사용 시 무효화 후 새 쌍 발급 (Rotation)
- Refresh Token은 User 엔티티에 `refreshTokenHash` 필드로 해시 저장

**Rationale**: 완전한 stateless는 Refresh Token 탈취 시 위험. Rotation으로 탈취 감지 가능 (사용된 토큰 재사용 시 전체 세션 무효화).

### 2. API Key Authentication

**Decision**: Custom NestJS Guard (`ApiKeyGuard`)

- Key 형식: `aegis_` + 32바이트 hex (총 38자)
- 저장: SHA-256 해시만 DB 저장
- 인증 플로우: `x-api-key` 헤더 → SHA-256 해시 → DB 조회 → TenantContext 설정
- Scopes: JSON 배열 (`["gpt-4o", "claude-sonnet-4-20250514"]`), 모델 접근 제한용

**Rationale**: Passport의 API Key strategy 대신 custom guard를 사용하는 이유 — 단순하고 직접적. 미들웨어 체인이 짧아 디버깅 용이.

### 3. Multi-tenancy Isolation

**Decision**: Row-Level Security (Shared Table + tenant_id)

- 모든 tenant-scoped 테이블에 `org_id` 컬럼 추가
- TypeORM `@BeforeInsert`, `@BeforeUpdate` 훅으로 자동 tenant_id 삽입
- Repository 레벨에서 `createQueryBuilder` 래핑 → 자동 WHERE 조건 추가
- 대안 (Schema-per-tenant, DB-per-tenant)은 MVP 규모에서 과도한 복잡성

**Rationale**: MVP 규모 (수십 개 테넌트)에서 가장 단순하고 운영 부담 최소.

### 4. Password Hashing

**Decision**: bcrypt (cost factor 10)

- Library: `bcryptjs` (순수 JS, 네이티브 의존성 없음)
- `@BeforeInsert` 훅으로 엔티티 저장 전 자동 해싱
- Timing attack 방지: `bcrypt.compare()` 내장

### 5. TenantContext Propagation

**Decision**: NestJS Injectable + AsyncLocalStorage 패턴

- `TenantContextMiddleware`: 요청 진입점에서 API Key 또는 JWT에서 orgId 추출
- `TenantContext` 클래스: `@Injectable({ scope: Scope.REQUEST })` 또는 AsyncLocalStorage
- Controller/Service/Repository 전 레이어에서 동일한 TenantContext 참조
- MVP에서는 `REQUEST` scope Injectable로 시작 (단순)

## Resolved Clarifications

- **JWT_SECRET 관리**: 환경변수 (`JWT_SECRET`, `JWT_REFRESH_SECRET`) 사용. .env.example에 추가.
- **API Key 길이**: `aegis_` + 32바이트 hex = 38자. UUID보다 짧고 식별 가능.
- **Refresh Token 저장**: User 테이블에 `refreshTokenHash` 컬럼. 별도 RefreshToken 테이블은 MVP에서 과도.
- **Rate Limiting**: F003에서 미포함. 별도 Feature 또는 Nginx 레벨에서 처리.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/jwt` | ^10.x | JWT 생성/검증 |
| `@nestjs/passport` | ^10.x | Passport 통합 |
| `passport-jwt` | ^4.x | JWT Passport strategy |
| `bcryptjs` | ^2.4.x | Password hashing |
| `class-validator` | (기존) | DTO 유효성 검사 |
| `class-transformer` | (기존) | DTO 변환 |
