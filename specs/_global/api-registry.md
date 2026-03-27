# API Registry — AEGIS

> Feature 간 API 계약. `speckit-plan` 실행 시 채워짐.

## F001 — Foundation Setup

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/health` | F001 | All | 헬스체크 (DB + Redis 연결 상태) |

## F002 — LLM Gateway Core

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| POST | `/v1/chat/completions` | F002 | External clients, F012 | OpenAI-compatible 통합 LLM API (SSE streaming 지원) |

## F003 — Auth & Multi-tenancy

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| POST | `/auth/login` | F003 | F007, F012 | JWT 로그인 |
| POST | `/auth/refresh` | F003 | F007, F012 | JWT 토큰 갱신 |
| GET | `/organizations` | F003 | F007 | 조직 목록 조회 |
| GET | `/organizations/:id` | F003 | F007 | 조직 상세 조회 |
| GET | `/teams` | F003 | F007 | 팀 목록 조회 |
| GET | `/users` | F003 | F007 | 사용자 목록 조회 |
| POST | `/api-keys` | F003 | F007 | API Key 생성 |
| GET | `/api-keys` | F003 | F007 | API Key 목록 조회 |
| DELETE | `/api-keys/:id` | F003 | F007 | API Key 폐기 |
| PATCH | `/users/:id` | F007 (F003 보조) | F007 | 사용자 역할/팀 수정 (Admin 전용) |

## F004 — Token Budget Management

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/budgets/:level/:id` | F004 | F007 | 예산 조회 (level: org/team/user) |
| PUT | `/budgets/:level/:id` | F004 | F007 | 예산 설정/수정 |
| GET | `/usage/:level/:id` | F004 | F007 | 사용량 조회 |
| GET | `/usage/summary` | F004 | F007 | 사용량 요약 (기간별) |
| POST | `/model-tiers` | F004 | F007 | 모델 티어 생성 (Admin) |
| GET | `/model-tiers` | F004 | F007 | 모델 티어 목록 조회 |
| PUT | `/model-tiers/:id` | F004 | F007 | 모델 티어 수정 |
| DELETE | `/model-tiers/:id` | F004 | F007 | 모델 티어 삭제 |

## F005 — Request Logging & Tracing

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/logs` | F005 | F007 | 요청 로그 목록/검색 |
| GET | `/logs/:id` | F005 | F007 | 요청 로그 상세 |
| GET | `/analytics/usage` | F005 | F007 | 사용량 분석 (모델별, 기간별, 팀별) |
| GET | `/analytics/cost` | F005 | F007 | 비용 분석 |

## F006 — Security Guardrails

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/security-policies/:orgId` | F006 | F007 | 테넌트 보안 정책 조회 |
| PUT | `/security-policies/:orgId` | F006 | F007 | 테넌트 보안 정책 수정 |

## F007 — Admin Dashboard

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| — | `/dashboard/*` | F007 (UI) | Browser | Next.js 웹 대시보드 |
| GET | `/events/stream` | F007 (Backend) | F007 (UI) | SSE 실시간 이벤트 스트림 (테넌트 격리, JWT 인증) |

## F008 — Provider Fallback & LB

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/providers/health` | F008 | F007 | 프로바이더 헬스 상태 조회 |

## F009 — Knowledge Integration

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| POST | `/documents` | F009 | F007, Admin | 문서 업로드 → 202 (비동기 임베딩) |
| GET | `/documents` | F009 | F007 | 문서 목록 |
| GET | `/documents/:id` | F009 | F007 | 문서 상세 (status, chunk_count) |
| DELETE | `/documents/:id` | F009 | F007, Admin | 문서 삭제 + 임베딩 cascade |
| POST | `/knowledge/query` | F009 | F012 | 지식 쿼리 (MCP/RAG/HYBRID 라우터) |
| POST | `/mcp-servers` | F009 | Admin | MCP 서버 등록 (tools/list 자동) |
| GET | `/mcp-servers` | F009 | F007 | MCP 서버 목록 |
| DELETE | `/mcp-servers/:id` | F009 | Admin | MCP 서버 삭제 |
| POST | `/mcp-servers/:id/call` | F009 | F012 | MCP 도구 호출 (JSON-RPC 5s) |

## F010 — Prompt Management

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| POST | `/prompts` | F010 | F007, F012 | 프롬프트 생성 |
| GET | `/prompts` | F010 | F007, F012 | 프롬프트 목록 |
| GET | `/prompts/:id` | F010 | F007, F012 | 프롬프트 상세 |
| PUT | `/prompts/:id` | F010 | F007, F012 | 프롬프트 수정 (새 버전 생성) |
| DELETE | `/prompts/:id` | F010 | F007 | 프롬프트 삭제 (cascade) |
| GET | `/prompts/:id/versions` | F010 | F007, F012 | 버전 이력 |
| POST | `/prompts/:id/publish` | F010 | F007 | 버전 배포 |
| POST | `/prompts/:id/rollback` | F010 | F007 | 버전 롤백 |
| POST | `/prompts/:id/ab-test` | F010 | F007 | A/B 테스트 설정 |
| GET | `/prompts/:id/ab-test/stats` | F010 | F007 | A/B 테스트 통계 |
| DELETE | `/prompts/:id/ab-test` | F010 | F007 | A/B 테스트 종료 |
| POST | `/prompts/:id/resolve` | F010 | F012 | 프롬프트 해결 (변수 치환) |
| GET | `/prompts/:id/stats` | F010 | F007 | 프롬프트 사용 통계 |

## F011 — Semantic Cache

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| GET | `/cache/stats` | F011 | F007 | 캐시 통계 (히트율, 절감 비용) |
| DELETE | `/cache` | F011 | F007 | 캐시 무효화 |
| PUT | `/cache/policy/:orgId` | F011 | F007 | 캐시 정책 설정 |

## F012 — Developer Playground

| Method | Path | Provider | Consumer(s) | Description |
|--------|------|----------|-------------|-------------|
| — | `/playground/*` | F012 (UI) | Browser | 개발자 Playground 웹 UI |

## 내부 서비스 (NestJS Guards/Interceptors)

| Service | Provider | Consumer(s) | Description |
|---------|----------|-------------|-------------|
| AuthGuard | F003 | F002, F004, F005, F006, F009, F010, F011 | API Key / JWT 인증 가드 |
| TenantContext | F003 | F002, F004, F005, F006, F009, F010, F011 | 테넌트 컨텍스트 미들웨어 |
| BudgetGuard | F004 | F002 | LLM 요청 전 예산 체크 가드 |
| GuardPipeline | F006 | F002 | LLM 입출력 보안 스캐닝 파이프라인 |
| RequestLogger | F005 | F002 | LLM 요청/응답 로깅 인터셉터 |
| CacheInterceptor | F011 | F002 | 시맨틱 캐시 조회/저장 인터셉터 |
