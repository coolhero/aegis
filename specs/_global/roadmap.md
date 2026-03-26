# AEGIS 로드맵

## 프로젝트 개요

**AEGIS** (AI Enterprise Gateway & Intelligence System) — 기업이 LLM을 안전하고 효율적으로 사용할 수 있게 해주는 셀프호스팅 가능한 AI 게이트웨이 플랫폼. 멀티프로바이더 LLM 라우팅, 계층적 토큰 예산 관리, 보안 가드레일, 엔터프라이즈 거버넌스를 통합 제공.

## 개발 전략

그린필드 — 새 프로젝트, 기존 코드베이스 없음.

## Feature 카탈로그

| FID | Name | Tier | Release Group | Description | Dependencies |
|-----|------|------|---------------|-------------|--------------|
| F001 | Foundation Setup | T0 | RG1 | NestJS 모노레포 + PostgreSQL + Redis + Docker Compose + 헬스체크 + 환경 관리 | — |
| F002 | LLM Gateway Core | T1 | RG1 | OpenAI/Anthropic 프로바이더 추상화, 통합 /v1/chat/completions, SSE 스트리밍 프록시 | F001 |
| F003 | Auth & Multi-tenancy | T1 | RG1 | API Key 인증 + JWT 세션, Org>Team>User 계층 구조, RBAC | F001 |
| F004 | Token Budget Management | T1 | RG1 | 계층적 예산 (Org>Team>User), 토큰+비용 이중 추적, Redis 원자적 연산, 알림 | F001, F003 |
| F005 | Request Logging & Tracing | T1 | RG1 | LLM 요청 로깅, 비용 귀속, Langfuse/OpenTelemetry 통합 | F001, F002, F003 |
| F006 | Security Guardrails | T2 | RG2 | LLM Guard 입출력 스캐닝, PII 탐지/마스킹, 프롬프트 인젝션 방어 | F002, F003 |
| F007 | Admin Dashboard | T2 | RG2 | Next.js + shadcn/ui 대시보드, 사용량/비용 차트, 예산/사용자 관리, SSE 실시간 | F001, F003, F004, F005 |
| F008 | Provider Fallback & LB | T2 | RG2 | 프로바이더 헬스체크, 자동 페일오버, 지연 기반 라우팅, 서킷 브레이커, 최대 2-hop 폴백 | F002 |
| F009 | Knowledge Integration | T3 | RG3 | MCP 도구 서버 + pgvector RAG, 쿼리 유형 라우터, 문서 임베딩 파이프라인 | F002, F003 |
| F010 | Prompt Management | T3 | RG3 | 프롬프트 버전 관리, 템플릿 시스템, A/B 테스트 | F002, F003 |
| F011 | Semantic Cache | T3 | RG3 | pgvector 코사인 유사도 캐시, 히트율 모니터링, 테넌트별 캐시 정책 | F002, F003 |
| F012 | Developer Playground | T3 | RG4 | 모델 테스트 UI, 비용 추정, API 탐색기, 프롬프트 편집기 | F002, F003, F007 |

## 의존성 그래프

```
F001 Foundation Setup
 ├── F002 LLM Gateway Core
 │    ├── F005 Request Logging & Tracing ← (F001, F003도 필요)
 │    ├── F006 Security Guardrails ← (F003도 필요)
 │    ├── F008 Provider Fallback & LB
 │    ├── F009 Knowledge Integration ← (F003도 필요)
 │    ├── F010 Prompt Management ← (F003도 필요)
 │    └── F011 Semantic Cache ← (F003도 필요)
 ├── F003 Auth & Multi-tenancy
 │    ├── F004 Token Budget Management ← (F001도 필요)
 │    ├── F005 Request Logging & Tracing ← (F001, F002도 필요)
 │    ├── F006 Security Guardrails ← (F002도 필요)
 │    ├── F007 Admin Dashboard ← (F001, F004, F005도 필요)
 │    ├── F009 Knowledge Integration ← (F002도 필요)
 │    ├── F010 Prompt Management ← (F002도 필요)
 │    ├── F011 Semantic Cache ← (F002도 필요)
 │    └── F012 Developer Playground ← (F002, F007도 필요)
 └── F004 Token Budget Management ← (F003도 필요)
      └── F007 Admin Dashboard ← (F001, F003, F005도 필요)
```

## Release Groups

### RG1 — 코어 플랫폼 (T0 + T1)
> MVP 핵심: 기반 인프라 + LLM 게이트웨이 + 인증 + 예산 + 로깅

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | F001 Foundation Setup | 모든 Feature의 기반. 선행 필수. |
| 2 | F002 LLM Gateway Core | 핵심 비즈니스 로직. F001 완료 후 즉시 착수. |
| 3 | F003 Auth & Multi-tenancy | 멀티테넌트 격리. F002와 병렬 가능 (F001만 의존). |
| 4 | F004 Token Budget Management | 예산 관리. F003 완료 후 착수. |
| 5 | F005 Request Logging & Tracing | 로깅/트레이싱. F002+F003 완료 후 착수. |

### RG2 — 엔터프라이즈 기능 (T2)
> 보안, 대시보드, 안정성 강화

| Order | Feature | Rationale |
|-------|---------|-----------|
| 6 | F006 Security Guardrails | 보안 가드레일. F002+F003 필요. |
| 7 | F008 Provider Fallback & LB | 프로바이더 안정성. F002만 필요, 독립 착수 가능. |
| 8 | F007 Admin Dashboard | 관리 UI. F003+F004+F005 데이터 필요. |

### RG3 — 인텔리전스 기능 (T3)
> 지식 통합, 프롬프트 관리, 캐싱

| Order | Feature | Rationale |
|-------|---------|-----------|
| 9 | F009 Knowledge Integration | RAG + MCP. F002+F003 필요. |
| 10 | F010 Prompt Management | 프롬프트 버전 관리. F002+F003 필요. |
| 11 | F011 Semantic Cache | 시맨틱 캐시. F002+F003 필요. |

### RG4 — 개발자 경험 (T3)
> 개발자 도구

| Order | Feature | Rationale |
|-------|---------|-----------|
| 12 | F012 Developer Playground | 개발자 UI. F007 대시보드 프레임워크 공유. |

## 데모 그룹

### DG1 — 코어 게이트웨이 데모
> Features: F001, F002, F003
> "API Key로 인증 → OpenAI/Anthropic 통합 API 호출 → SSE 스트리밍 응답 수신"

### DG2 — 예산 및 옵저버빌리티 데모
> Features: F004, F005
> "예산 설정 → LLM 요청 → 실시간 예산 차감 → 로그 조회 → 80% 알림 수신"

### DG3 — 엔터프라이즈 보안 데모
> Features: F006, F007, F008
> "PII 마스킹 → 프롬프트 인젝션 차단 → 대시보드에서 가드레일 현황 확인 → 프로바이더 장애 시 자동 폴백"

### DG4 — 인텔리전스 및 DX 데모
> Features: F009, F010, F011, F012
> "문서 업로드 → RAG 검색 → 프롬프트 A/B 테스트 → 시맨틱 캐시 히트 → Playground에서 실시간 테스트"

## Feature 간 Entity/API 의존성

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
