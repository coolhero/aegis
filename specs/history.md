# Decision History

> Auto-generated during `/reverse-spec` and `/smart-sdd` execution.
> Records key strategic and architectural decisions with rationale.

---

## [2026-03-25] /smart-sdd init — Project Setup

### Proposal Mode (CI: 97%)

| Decision | Details |
|----------|---------|
| Init Mode | Proposal Mode — idea string provided with high clarity (97%) |
| Domain Profile | Interfaces: http-api, gui / Concerns: 12 (auth, authorization, multi-tenancy, resilience, observability, realtime, stream-processing, external-sdk, audit-logging, compliance, token-budget, prompt-guard) / Archetype: ai-gateway |
| Custom Modules | 3 project-local modules created: ai-gateway (archetype), token-budget (concern), prompt-guard (concern) |
| Project Maturity | mvp — explicit "MVP for small team" in input |
| Team Context | small-team — explicit in input |
| Feature Tiers | T0 (foundation), T1 (4 core features), T2 (3 features), T3 (4 features) — 12 total |

### Constitution

| Decision | Details |
|----------|---------|
| Best Practices | All 6 adopted (Test-First, Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution, Demo-Ready Delivery) |
| Signal-Driven Principles | 9 principles: Tenant Data Isolation, Streaming-First, Model Agnosticism, Contract Testing, Retry with Backoff, Secure Token Storage, Audit Trail, EU AI Act Compliance, Start Simple (YAGNI) |
| Custom Principles | None |

---

## [2026-03-25] /smart-sdd add — Feature Definition

### Feature Briefing (12 Features)

| Decision | Details |
|----------|---------|
| Entry Type | Type 2 (Conversational) — Proposal Features as seed |
| Feature Count | 12 Features across 4 Tiers |
| Release Groups | RG1 (T0+T1, 5), RG2 (T2, 3), RG3 (T3, 3), RG4 (T3, 1) |
| Demo Groups | DG1~DG4 |
| Entity Count | 20 entities defined in entity-registry |
| API Count | All endpoints pre-defined in api-registry |

### Key S5 Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| F001 | Standard NestJS setup | Docker Compose + Health Check 포함. 최소한이되 운영 가능한 기반 |
| F002 | OpenAI + Anthropic | 2대 프로바이더로 시작, Provider 추상화로 확장 용이 |
| F003 | API Key + JWT | API Key는 LLM 호출용, JWT는 대시보드 세션용 |
| F006 | LLM Guard (MIT) | 오픈소스 기반 비용 효율, 15 input/20 output scanners |
| F007 | Next.js + shadcn/ui | 모던 UI 프레임워크, TanStack Query로 서버 상태 관리 |
| F009 | MCP + Vector RAG | MCP가 2026년 표준, pgvector로 RAG 하이브리드 |
