# SDD State — AEGIS

**Origin**: greenfield
**Scope**: full
**Artifact Language**: ko
**Project Maturity**: mvp
**Team Context**: small-team
**Org Convention**: none
**Custom**: specs/domains

## 도메인 프로파일

**Interfaces**: http-api, gui
**Concerns**: auth, authorization, multi-tenancy, resilience, observability, realtime, stream-processing, external-sdk, audit-logging, compliance, token-budget, prompt-guard
**Archetype**: ai-gateway
**Foundation**: typescript-nestjs
**Context Mode**: greenfield
**Context Modifiers**: (없음)

## 명확도 지수

**CI Score**: 97% (35/36)

| Dimension | Weight | Confidence | Points |
|-----------|--------|------------|--------|
| Core Purpose | x3 | 3 | 9 |
| Key Capabilities | x3 | 3 | 9 |
| Project Type | x2 | 3 | 6 |
| Tech Stack | x1 | 3 | 3 |
| Target Users | x1 | 2 | 2 |
| Scale & Scope | x1 | 3 | 3 |
| Constraints | x1 | 3 | 3 |

## Feature 진행 상황

| FID | Name | Status | Tier | Phase | Branch | Notes |
|-----|------|--------|------|-------|--------|-------|
| F001 | Foundation Setup | completed | T0 | verified | main | Lint 완료 (eslint.config.mjs), SC 8/8 런타임 통과, verify-report.md |
| F002 | LLM Gateway Core | completed | T1 | verified | main | SC 4/4 런타임 통과 (실제 LLM 연동), verify-report.md |
| F003 | Auth & Multi-tenancy | completed | T1 | verified | main | SC 10/10 런타임 통과, 인라인 수정: SC-003 jti, verify-report.md |
| F004 | Token Budget Management | completed | T1 | verified | main | SC 13/20 런타임 통과, 7/20 limited. ModelTier 포함. verify-report.md |
| F005 | Request Logging & Tracing | in-progress | T1 | verified | 005-request-logging-tracing | SC 8/16 런타임, 5/16 unit-only (예산429+Langfuse미구성). verify-report.md |
| F006 | Security Guardrails | pending | T2 | pre-context | — | |
| F007 | Admin Dashboard | pending | T2 | pre-context | — | |
| F008 | Provider Fallback & LB | pending | T2 | pre-context | — | |
| F009 | Knowledge Integration | pending | T3 | pre-context | — | |
| F010 | Prompt Management | pending | T3 | pre-context | — | |
| F011 | Semantic Cache | pending | T3 | pre-context | — | |
| F012 | Developer Playground | pending | T3 | pre-context | — | |

## 도구 체인

| Tool | Status | Command | Notes |
|------|--------|---------|-------|
| Build | 사용 가능 | `npm run build` (nest build api, webpack) | |
| Test | 사용 가능 | `npm test` (jest) | 107개 테스트, 16개 스위트 |
| Lint | 사용 가능 | `npm run lint` (eslint v10 + typescript-eslint) | eslint.config.mjs, 에러 0건 경고 35건 |
