# Pre-Context: F003 — Auth & Multi-tenancy

## Feature Summary
API Key 인증과 JWT 대시보드 세션을 제공하고, Organization > Team > User 계층 구조 기반의 멀티테넌시와 RBAC 권한 관리를 구현한다.

## User & Purpose
- **Actor(s)**: 조직 관리자(Org Admin), 팀 리더, 개발자, 대시보드 사용자
- **Problem**: 멀티테넌트 환경에서 테넌트 간 데이터 격리, 세분화된 접근 제어, API와 대시보드 이중 인증이 필요
- **Key Scenarios**: API Key로 LLM 요청 인증, JWT로 대시보드 로그인, 조직 관리자가 팀/사용자 관리, RBAC로 기능별 접근 제한

## Capabilities
- API Key 기반 인증 (LLM API 호출용)
- JWT 세션 관리 (대시보드 접근용)
- Organization > Team > User 계층 구조
- RBAC 역할: admin, member, viewer
- API Key CRUD (생성, 폐기, 권한 범위 설정)
- 테넌트 컨텍스트 미들웨어 (요청마다 테넌트 식별 및 전파)
- Row-Level Security 또는 tenant_id 기반 데이터 격리

## Data Ownership
- **소유**: Organization, Team, User, ApiKey
- **참조**: AppConfig (F001)

## Interfaces
- **제공**: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/api-keys`, `GET /organizations`, `GET /teams`, `GET /users`, AuthGuard (NestJS Guard), TenantContext 미들웨어
- **소비**: F001 ConfigModule, DatabaseModule, RedisModule

## Dependencies
- F001 Foundation Setup

## Domain-Specific Notes
- **ai-gateway A1 Multi-tenant Isolation**: 각 테넌트는 완전 격리 — 별도 예산, API 키, 모델 접근 정책, 감사 추적. 테넌트 간 데이터 누출 불가.
- **ai-gateway A4 Tenant Context**: 게이트웨이 엣지에서 테넌트 컨텍스트 확립 후 모든 레이어에 전파. 요청 중간에 재조회 금지.
- **AG-003 Tenant Isolation Bypass**: 에러 핸들러가 다른 테넌트의 캐시 응답을 반환하는 버그 방지. 캐시 키에 tenant ID 필수 포함.

## /speckit.specify 참고사항
- SC 필수: 테넌트 컨텍스트 결정 방식 (API Key → tenant lookup, JWT → tenant claim)
- SC 필수: RBAC 역할별 허용 작업 매트릭스
- SC 필수: API Key 생성 시 권한 범위 (모델 제한, IP 제한 등)
- 테넌트 격리 검증: cross-tenant 접근 불가 테스트 시나리오 포함
- JWT refresh token rotation 전략 결정 필요
- API Key 해싱 저장 (평문 저장 금지)
