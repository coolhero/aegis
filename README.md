# AEGIS — AI Enterprise Gateway & Intelligence System

Enterprise AI Support Platform — 기업이 LLM을 안전하고 효율적으로 사용할 수 있게 해주는 셀프호스팅 가능한 AI 게이트웨이 플랫폼.

## Overview

AEGIS는 멀티프로바이더 LLM 라우팅, 계층적 토큰 예산 관리, 보안 가드레일, 엔터프라이즈 거버넌스를 통합 제공하는 오픈소스 AI 게이트웨이입니다.

**핵심 가치**: 어떤 단일 플랫폼도 아직 제공하지 않는 5가지를 하나로 통합
- 고성능 LLM 라우팅 (멀티프로바이더)
- 멀티테넌트 비용 격리 (Org > Team > User)
- 보안 가드레일 (OWASP LLM Top 10 대응)
- 기업 내부 지식 통합 (RAG + MCP)
- 완전한 셀프호스팅

## Features

### T0 — Foundation

| Feature | Description | Status |
|---------|-------------|--------|
| **F001 Foundation Setup** | NestJS 모노레포 + PostgreSQL + Redis + Docker Compose + 헬스체크 + 환경 관리 | ✅ Completed |

### T1 — Core Platform (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| **F002 LLM Gateway Core** | OpenAI/Anthropic 프로바이더 추상화, 통합 `/v1/chat/completions`, SSE 스트리밍 프록시 | ✅ Completed |
| **F003 Auth & Multi-tenancy** | API Key 인증 + JWT 세션, Org>Team>User 계층 구조, RBAC | ✅ Completed |
| **F004 Token Budget Management** | 계층적 예산 (Org>Team>User), 토큰+비용 이중 추적, Redis 원자적 연산, 알림 | ✅ Completed |
| **F005 Request Logging & Tracing** | LLM 요청 로깅, 비용 귀속, Langfuse/OpenTelemetry 통합 | ✅ Completed |

### T2 — Enterprise

| Feature | Description | Status |
|---------|-------------|--------|
| **F006 Security Guardrails** | PII 탐지/마스킹, 프롬프트 인젝션 방어, 테넌트별 보안 정책 | ✅ Completed |
| **F007 Admin Dashboard** | Next.js + shadcn/ui 대시보드, 사용량/비용 차트, 예산/사용자 관리, SSE 실시간 | ✅ Completed |
| **F008 Provider Fallback & LB** | 프로바이더 헬스체크, 자동 페일오버, 지연 기반 라우팅, 서킷 브레이커, 최대 2-hop 폴백 | ✅ Completed |

### T3 — Intelligence

| Feature | Description | Status |
|---------|-------------|--------|
| **F009 Knowledge Integration** | MCP 도구 서버 + pgvector RAG, 쿼리 유형 라우터, 문서 임베딩 파이프라인 | ✅ Completed |
| **F010 Prompt Management** | 프롬프트 버전 관리, 템플릿 시스템, 변수 치환, A/B 테스트 | ✅ Completed |
| **F011 Semantic Cache** | pgvector 코사인 유사도 캐시, 히트율 모니터링, 테넌트별 캐시 정책, Fail-open | ✅ Completed |
| **F012 Developer Playground** | 모델 테스트 UI, 비용 추정, API 탐색기, 프롬프트 편집기, 모델 비교 | ✅ Completed |

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         Client / Dashboard       │
                    │     (Next.js + shadcn/ui)        │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │       API Gateway (NestJS)       │
                    │                                  │
                    │  ┌──────────┐  ┌──────────────┐  │
                    │  │Auth Guard│  │Budget Guard  │  │
                    │  │ (JWT/Key)│  │(Token Check) │  │
                    │  └────┬─────┘  └──────┬───────┘  │
                    │       │               │          │
                    │  ┌────▼───────────────▼───────┐  │
                    │  │   Security Guardrails      │  │
                    │  │  (PII Mask + Injection Def) │  │
                    │  └────────────┬───────────────┘  │
                    │               │                  │
                    │  ┌────────────▼───────────────┐  │
                    │  │   Semantic Cache (pgvector) │  │
                    │  └────────────┬───────────────┘  │
                    │               │                  │
                    │  ┌────────────▼───────────────┐  │
                    │  │   LLM Router               │  │
                    │  │  (Fallback + Load Balance)  │  │
                    │  └──┬─────────┬───────────┬───┘  │
                    │     │         │           │      │
                    └─────┼─────────┼───────────┼──────┘
                          │         │           │
                   ┌──────▼──┐ ┌───▼────┐ ┌───▼────────┐
                   │ OpenAI  │ │Anthropic│ │ Knowledge  │
                   │   API   │ │   API   │ │ (RAG+MCP)  │
                   └─────────┘ └────────┘ └────────────┘

    ┌──────────────────────────────────────────────┐
    │              Infrastructure                   │
    │  PostgreSQL (+ pgvector) │ Redis │ BullMQ    │
    │  Langfuse (Observability)                    │
    └──────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | **TypeScript** | 프론트엔드/백엔드 통합, 타입 안전성 |
| Backend | **NestJS** | 엔터프라이즈급 DI, 모듈 시스템, Guards/Interceptors |
| Frontend | **Next.js** + shadcn/ui + TanStack Query + Recharts | Admin Dashboard + Developer Playground |
| Database | **PostgreSQL** + pgvector | 관계형 + 벡터 검색 통합 |
| Cache/Queue | **Redis** + BullMQ | 세션, 토큰 한도, 시맨틱 캐시, 비동기 작업 |
| Observability | **Langfuse** (self-hosted) | 오픈소스 LLM 관찰성 |
| Testing | **Jest** + Playwright | 유닛/통합 테스트 + E2E |

## Project Structure

```
aegis/
├── apps/
│   ├── api/          # NestJS backend (F001~F011)
│   │   └── src/
│   │       ├── auth/           # JWT + API Key 인증, RBAC
│   │       ├── budget/         # 계층적 토큰 예산 관리
│   │       ├── gateway/        # LLM 프로바이더 라우팅 + 스트리밍
│   │       ├── guardrails/     # PII 마스킹 + 프롬프트 인젝션 방어
│   │       ├── knowledge/      # RAG (pgvector) + MCP 서버 연동
│   │       ├── logging/        # 요청 로깅 + Langfuse 연동
│   │       ├── prompt/         # 프롬프트 관리 + A/B 테스트
│   │       ├── provider/       # 헬스체크 + 폴백 + 서킷 브레이커
│   │       ├── cache/          # 시맨틱 캐시 (pgvector 코사인 유사도)
│   │       └── organization/   # Org > Team > User 멀티테넌시
│   └── web/          # Next.js frontend (F007 + F012)
│       └── src/app/
│           ├── dashboard/      # Admin Dashboard
│           └── playground/     # Developer Playground
├── libs/
│   └── common/       # Shared utilities, entities, guards
├── specs/            # SDD artifacts (per-Feature)
│   ├── _global/      # GEL artifacts (roadmap, registries, sdd-state)
│   ├── domains/      # Custom domain modules (ai-gateway, token-budget, prompt-guard)
│   └── 001~012/      # Per-Feature specs (spec.md, plan.md, tasks.md)
├── demos/            # Feature demo scripts
├── docs/             # Case study, research, skill feedback
├── docker-compose.yml
└── package.json
```

## Quick Start

```bash
# Prerequisites: Node.js 18+, PostgreSQL (with pgvector), Redis, Docker

# 1. Clone and install
git clone https://github.com/your-org/aegis.git
cd aegis
npm install
cd apps/web && npm install && cd ../..

# 2. Start infrastructure
docker compose up -d  # PostgreSQL + Redis

# 3. Configure environment
cp .env.example .env
# Edit .env with your database, Redis, and LLM API keys

# 4. Start API server
npm run start:dev

# 5. Start Dashboard
cd apps/web && npm run dev

# 6. Open browser
open http://localhost:3001/login
# Default: admin@demo.com / password123
```

## API

통합 LLM 엔드포인트:

```bash
# Chat Completion (OpenAI-compatible)
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

주요 API:

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | LLM 채팅 (OpenAI 호환, SSE 스트리밍) |
| `POST /auth/login` | JWT 로그인 |
| `POST /auth/api-keys` | API Key 발급 |
| `GET /budgets/:id` | 예산 조회 |
| `POST /knowledge/documents` | 문서 업로드 (RAG) |
| `POST /knowledge/query` | 지식 검색 |
| `GET /prompts` | 프롬프트 템플릿 목록 |
| `POST /prompts/:id/resolve` | 프롬프트 변수 치환 |
| `GET /cache/stats` | 시맨틱 캐시 통계 |
| `GET /health` | 헬스체크 |

## Verify Results

| FID | Feature | SC Pass Rate | Verify Level |
|-----|---------|-------------|--------------|
| F001 | Foundation Setup | 8/8 | ✅ Runtime |
| F002 | LLM Gateway Core | 4/4 | ✅ Runtime |
| F003 | Auth & Multi-tenancy | 10/10 | ✅ Runtime |
| F004 | Token Budget Management | 14/14 | ✅ Runtime (regression 수정) |
| F005 | Request Logging & Tracing | 8/16 | ⚠️ Limited |
| F006 | Security Guardrails | 8/8 | ✅ Runtime |
| F007 | Admin Dashboard | 16/16 | ✅ Playwright |
| F008 | Provider Fallback & LB | 8/8 | ✅ Runtime |
| F009 | Knowledge Integration | 9/9 | ✅ Runtime |
| F010 | Prompt Management | 14/14 | ⚠️ Limited (code-level) |
| F011 | Semantic Cache | 11/11 | ⚠️ Limited (code-level, regression 수정) |
| F012 | Developer Playground | 12/12 | ⚠️ Limited (code-level) |

**Total**: 122 Success Criteria, 185 Tests, ~120 Source Files

## Development Methodology

이 프로젝트는 **Specification-Driven Development (SDD)** 방법론으로 개발되었습니다.

### SDD Pipeline

각 Feature는 다음 파이프라인을 거칩니다:

```
specify → plan → tasks → analyze → implement → verify → merge
```

- **specify**: 기능 요구사항 + Success Criteria 정의
- **plan**: 아키텍처 설계 + 데이터 모델 + API 계약
- **tasks**: 의존성 기반 태스크 분해
- **analyze**: 크로스 아티팩트 일관성 검증
- **implement**: 태스크 기반 구현 + Per-Task Micro-Verify
- **verify**: 런타임 SC 검증 (Playwright / curl / 코드 레벨)
- **merge**: Feature 브랜치 → main 머지

### Custom Domain Modules

3개의 프로젝트 특화 도메인 모듈을 생성하여 SC 품질과 버그 예방에 활용:

| Module | Type | Purpose |
|--------|------|---------|
| **ai-gateway** | Archetype | LLM 관리자 관점의 Provider Abstraction, Streaming-First, Token-Aware Routing |
| **token-budget** | Concern | 계층적 예산 모델, Race Condition/Double-Charge/Streaming Drift 방지 |
| **prompt-guard** | Concern | PII 마스킹, 인코딩 우회 방어, 스트리밍 경계 처리, Fail-closed |

## Case Study

이 프로젝트는 SDD 방법론의 실제 적용 과정을 상세히 기록한 Case Study입니다.

- **Case Study 문서**: [`docs/case-study.md`](docs/case-study.md)
- **Skill Feedback Log**: [`docs/skill-feedback.md`](docs/skill-feedback.md)

### 주요 수치

| Metric | Value |
|--------|-------|
| 개발 기간 | 4일 (2026-03-25 ~ 2026-03-28) |
| 총 Features | 12 (4 Tiers, 4 Release Groups) |
| 총 Success Criteria | 122 |
| 총 Tests | 185 |
| Skill Feedback | 22건 (P1~P18 + F007 P8~P11 + F008 P12~P13) |
| HARD STOP 가치 발휘 | 4건 (도메인 지식 주입, 크로스 Feature 수정) |
| Regressions 발견/수정 | 2건 (F004 estimation, F011 cache_hit) |

### 핵심 교훈

1. **Verify는 "빌드 통과"가 아니라 "실제 서버에서 SC 검증"**
2. **HARD STOP은 사용자가 도메인 지식을 주입하는 유일한 시점**
3. **Per-Task Micro-Verify**: F008(미적용→버그) vs F009(적용→3건 즉시 수정)
4. **Cross-Feature 연동 문제는 verify에서 발견됨** (F011 SC-011)
5. **프론트엔드와 백엔드는 다른 verify 전략이 필요**

## License

MIT
