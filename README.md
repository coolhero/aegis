# AEGIS — AI Enterprise Gateway & Intelligence System

Enterprise AI Support Platform — 기업이 LLM을 안전하고 효율적으로 사용할 수 있게 해주는 셀프호스팅 가능한 AI 게이트웨이 플랫폼.

## Overview

AEGIS는 멀티프로바이더 LLM 라우팅, 계층적 토큰 예산 관리, 보안 가드레일, 엔터프라이즈 거버넌스를 통합 제공하는 AI 게이트웨이입니다.

### Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **LLM Gateway Core** | OpenAI/Anthropic 프로바이더 추상화, 통합 `/v1/chat/completions`, SSE 스트리밍 프록시 | Completed |
| **Auth & Multi-tenancy** | API Key 인증 + JWT 세션, Org>Team>User 계층 구조, RBAC | Completed |
| **Token Budget Management** | 계층적 예산 (Org>Team>User), 토큰+비용 이중 추적, Redis 원자적 연산 | Completed |
| **Request Logging & Tracing** | LLM 요청 로깅, 비용 귀속, Langfuse/OpenTelemetry 통합 | Completed |
| **Security Guardrails** | PII 탐지/마스킹, 프롬프트 인젝션 방어, 테넌트별 보안 정책 | Completed |
| **Admin Dashboard** | Next.js + shadcn/ui 대시보드, 사용량/비용 차트, 예산/사용자 관리, SSE 실시간 | Completed |

## Tech Stack

- **Backend**: TypeScript + NestJS
- **Frontend**: Next.js (App Router) + shadcn/ui + TanStack Query + Recharts
- **Database**: PostgreSQL + pgvector
- **Cache/Queue**: Redis + BullMQ
- **Observability**: Langfuse (self-hosted)
- **Testing**: Jest + Playwright

## Project Structure

```
aegis/
├── apps/
│   ├── api/          # NestJS backend (F001~F006 + SSE events)
│   └── web/          # Next.js frontend (F007 Admin Dashboard)
├── libs/
│   └── common/       # Shared utilities, entities, guards
├── specs/            # SDD artifacts (spec.md, plan.md, tasks.md per Feature)
│   ├── _global/      # GEL artifacts (roadmap, registries, sdd-state)
│   └── 001~007/      # Per-Feature specs
├── demos/            # Feature demo scripts
└── docs/             # Case study, research, skill feedback
```

## Quick Start

```bash
# Prerequisites: Node.js 18+, PostgreSQL, Redis, Docker

# 1. Install dependencies
npm install
cd apps/web && npm install && cd ../..

# 2. Start infrastructure
docker compose up -d  # PostgreSQL + Redis

# 3. Start API server
npm run start:dev

# 4. Start Dashboard
cd apps/web && npm run dev

# 5. Open browser
open http://localhost:3001/login
# Login: admin@demo.com / password123
```

## Development Methodology

이 프로젝트는 [spec-kit-skills](https://github.com/anthropics/spec-kit-skills)의 **Specification-Driven Development (SDD)** 방법론으로 개발되었습니다.

### SDD Pipeline

각 Feature는 다음 파이프라인을 거칩니다:

```
specify → plan → tasks → analyze → implement → verify → merge
```

- **specify**: 기능 요구사항 + Success Criteria 정의
- **plan**: 아키텍처 설계 + 데이터 모델 + API 계약
- **tasks**: 의존성 기반 태스크 분해
- **analyze**: 크로스 아티팩트 일관성 검증
- **implement**: 태스크 기반 구현 + TDD
- **verify**: Playwright 런타임 SC 검증 + 빌드/테스트/린트
- **merge**: Feature 브랜치 → main 머지

### Completed Features

| FID | Feature | SC Pass Rate | Tests |
|-----|---------|-------------|-------|
| F001 | Foundation Setup | 8/8 | 168 |
| F002 | LLM Gateway Core | 4/4 | 168 |
| F003 | Auth & Multi-tenancy | 10/10 | 168 |
| F004 | Token Budget Management | 14/14 | 168 |
| F005 | Request Logging & Tracing | 8/16 (limited) | 168 |
| F006 | Security Guardrails | 8/8 | 168 |
| F007 | Admin Dashboard | 16/16 | 168 |

## spec-kit-skills Case Study

이 프로젝트는 spec-kit-skills의 **Case Study**로 진행되고 있습니다. SDD 방법론의 실제 적용 과정, 발견된 문제점(P1~P11), 개선 제안을 문서화하여 spec-kit-skills의 발전에 기여합니다.

- **Case Study 문서**: [`docs/case-study.md`](docs/case-study.md)
- **Skill Feedback Log**: [`docs/skill-feedback.md`](docs/skill-feedback.md) — SDD 파이프라인 실행 중 발견된 11개 문제점 (P1~P11)과 개선 제안
- **목표**: spec-kit-skills가 실제 엔터프라이즈 프로젝트에서 어떻게 동작하는지 검증하고, AI 에이전트의 SDD 준수도를 높이기 위한 가드레일 개선

주요 발견 사항:
- **P1~P7**: spec-kit-skills 자체의 템플릿 미준수, verify 스킵 등 → spec-kit-skills에서 수정 완료
- **P8**: 새 앱 npm install 미수행 → verify 런타임 스킵
- **P9**: API 파라미터 불일치를 "업스트림 미지원"으로 오분류
- **P10**: 페이지 렌더링 = SC PASS로 잘못 판정 (CRUD 동작 미검증)
- **P11**: 코드 작성 = 구현 완료 착각, spec 없이 코드 직접 추가, verify 후 cascading update 시 verify 스킵
