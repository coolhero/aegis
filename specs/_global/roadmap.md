# AEGIS Roadmap

## Project Overview

**AEGIS** (AI Enterprise Gateway & Intelligence System) — 기업이 LLM을 안전하고 효율적으로 사용할 수 있게 해주는 셀프호스팅 가능한 AI 게이트웨이 플랫폼. 멀티프로바이더 LLM 라우팅, 계층적 토큰 예산 관리, 보안 가드레일, 엔터프라이즈 거버넌스를 통합 제공.

## Development Strategy

Greenfield — 새 프로젝트, 기존 코드베이스 없음.

## Feature Catalog

| FID | Name | Tier | Release Group | Description | Dependencies |
|-----|------|------|---------------|-------------|--------------|
| F001 | Foundation Setup | T0 | RG1 | NestJS monorepo + PostgreSQL + Redis + Docker Compose + Health check + env management | — |
| F002 | LLM Gateway Core | T1 | RG1 | OpenAI/Anthropic provider abstraction, unified /v1/chat/completions, SSE streaming proxy | F001 |
| F003 | Auth & Multi-tenancy | T1 | RG1 | API Key auth + JWT sessions, Org>Team>User hierarchy, RBAC | F001 |
| F004 | Token Budget Management | T1 | RG1 | Hierarchical budget (Org>Team>User), token+cost dual tracking, Redis atomic ops, alerts | F001, F003 |
| F005 | Request Logging & Tracing | T1 | RG1 | LLM request logging, cost attribution, Langfuse/OpenTelemetry integration | F001, F002, F003 |
| F006 | Security Guardrails | T2 | RG2 | LLM Guard input/output scanning, PII detection/masking, prompt injection defense | F002, F003 |
| F007 | Admin Dashboard | T2 | RG2 | Next.js + shadcn/ui dashboard, usage/cost charts, budget/user management, SSE real-time | F001, F003, F004, F005 |
| F008 | Provider Fallback & LB | T2 | RG2 | Provider health check, auto-failover, latency routing, circuit breaker, max 2-hop fallback | F002 |
| F009 | Knowledge Integration | T3 | RG3 | MCP tool server + pgvector RAG, query-type router, document embedding pipeline | F002, F003 |
| F010 | Prompt Management | T3 | RG3 | Prompt version control, template system, A/B testing | F002, F003 |
| F011 | Semantic Cache | T3 | RG3 | pgvector cosine similarity cache, hit rate monitoring, per-tenant cache policy | F002, F003 |
| F012 | Developer Playground | T3 | RG4 | Model test UI, cost estimation, API explorer, prompt editor | F002, F003, F007 |

## Dependency Graph

```
F001 Foundation Setup
 ├── F002 LLM Gateway Core
 │    ├── F005 Request Logging & Tracing ← (also F001, F003)
 │    ├── F006 Security Guardrails ← (also F003)
 │    ├── F008 Provider Fallback & LB
 │    ├── F009 Knowledge Integration ← (also F003)
 │    ├── F010 Prompt Management ← (also F003)
 │    └── F011 Semantic Cache ← (also F003)
 ├── F003 Auth & Multi-tenancy
 │    ├── F004 Token Budget Management ← (also F001)
 │    ├── F005 Request Logging & Tracing ← (also F001, F002)
 │    ├── F006 Security Guardrails ← (also F002)
 │    ├── F007 Admin Dashboard ← (also F001, F004, F005)
 │    ├── F009 Knowledge Integration ← (also F002)
 │    ├── F010 Prompt Management ← (also F002)
 │    ├── F011 Semantic Cache ← (also F002)
 │    └── F012 Developer Playground ← (also F002, F007)
 └── F004 Token Budget Management ← (also F003)
      └── F007 Admin Dashboard ← (also F001, F003, F005)
```

## Release Groups

### RG1 — Core Platform (T0 + T1)
> MVP 핵심: 기반 인프라 + LLM 게이트웨이 + 인증 + 예산 + 로깅

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | F001 Foundation Setup | 모든 Feature의 기반. 선행 필수. |
| 2 | F002 LLM Gateway Core | 핵심 비즈니스 로직. F001 완료 후 즉시 착수. |
| 3 | F003 Auth & Multi-tenancy | 멀티테넌트 격리. F002와 병렬 가능 (F001만 의존). |
| 4 | F004 Token Budget Management | 예산 관리. F003 완료 후 착수. |
| 5 | F005 Request Logging & Tracing | 로깅/트레이싱. F002+F003 완료 후 착수. |

### RG2 — Enterprise Features (T2)
> 보안, 대시보드, 안정성 강화

| Order | Feature | Rationale |
|-------|---------|-----------|
| 6 | F006 Security Guardrails | 보안 가드레일. F002+F003 필요. |
| 7 | F008 Provider Fallback & LB | 프로바이더 안정성. F002만 필요, 독립 착수 가능. |
| 8 | F007 Admin Dashboard | 관리 UI. F003+F004+F005 데이터 필요. |

### RG3 — Intelligence Features (T3)
> 지식 통합, 프롬프트 관리, 캐싱

| Order | Feature | Rationale |
|-------|---------|-----------|
| 9 | F009 Knowledge Integration | RAG + MCP. F002+F003 필요. |
| 10 | F010 Prompt Management | 프롬프트 버전 관리. F002+F003 필요. |
| 11 | F011 Semantic Cache | 시맨틱 캐시. F002+F003 필요. |

### RG4 — Developer Experience (T3)
> 개발자 도구

| Order | Feature | Rationale |
|-------|---------|-----------|
| 12 | F012 Developer Playground | 개발자 UI. F007 대시보드 프레임워크 공유. |

## Demo Groups

### DG1 — Core Gateway Demo
> Features: F001, F002, F003
> "API Key로 인증 → OpenAI/Anthropic 통합 API 호출 → SSE 스트리밍 응답 수신"

### DG2 — Budget & Observability Demo
> Features: F004, F005
> "예산 설정 → LLM 요청 → 실시간 예산 차감 → 로그 조회 → 80% 알림 수신"

### DG3 — Enterprise Security Demo
> Features: F006, F007, F008
> "PII 마스킹 → 프롬프트 인젝션 차단 → 대시보드에서 가드레일 현황 확인 → 프로바이더 장애 시 자동 폴백"

### DG4 — Intelligence & DX Demo
> Features: F009, F010, F011, F012
> "문서 업로드 → RAG 검색 → 프롬프트 A/B 테스트 → 시맨틱 캐시 히트 → Playground에서 실시간 테스트"

## Cross-Feature Entity/API Dependencies

| Entity | Owner | Referenced By |
|--------|-------|---------------|
| AppConfig | F001 | F002, F003, F004, F005, F006, F007, F008 |
| Provider, Model | F002 | F005, F006, F008, F009, F010, F011, F012 |
| GatewayRequest | F002 | F005, F006, F010, F011 |
| Organization, Team, User | F003 | F004, F005, F006, F007, F009, F010, F011, F012 |
| ApiKey | F003 | F007 |
| Budget, UsageRecord | F004 | F007 |
| RequestLog | F005 | F007 |
| SecurityPolicy, GuardResult | F006 | — |
| Document, Embedding, McpServer | F009 | — |
| PromptTemplate, PromptVersion | F010 | F012 |
| CacheEntry | F011 | — |
