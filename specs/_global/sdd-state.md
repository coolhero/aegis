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


| Dimension        | Weight | Confidence | Points |
| ---------------- | ------ | ---------- | ------ |
| Core Purpose     | x3     | 3          | 9      |
| Key Capabilities | x3     | 3          | 9      |
| Project Type     | x2     | 3          | 6      |
| Tech Stack       | x1     | 3          | 3      |
| Target Users     | x1     | 2          | 2      |
| Scale & Scope    | x1     | 3          | 3      |
| Constraints      | x1     | 3          | 3      |


## Feature 진행 상황


| FID  | Name                      | Status      | Tier | Phase       | Branch                  | Notes                                                                                 |
| ---- | ------------------------- | ----------- | ---- | ----------- | ----------------------- | ------------------------------------------------------------------------------------- |
| F001 | Foundation Setup          | completed   | T0   | verified    | main                    | Lint 완료 (eslint.config.mjs), SC 8/8 런타임 통과, verify-report.md                          |
| F002 | LLM Gateway Core          | completed   | T1   | verified    | main                    | SC 4/4 런타임 통과 (실제 LLM 연동), verify-report.md                                           |
| F003 | Auth & Multi-tenancy      | completed   | T1   | verified    | main                    | SC 10/10 런타임 통과, 인라인 수정: SC-003 jti, verify-report.md                                 |
| F004 | Token Budget Management   | completed   | T1   | verified    | main                    | FR-005 reconciliation 수정, FR-016 pessimistic estimation. SC-003/014 런타임 통과. 107 tests |
| F005 | Request Logging & Tracing | completed   | T1   | verified    | main                    | SC 8/16 런타임, 5/16 unit-only (limited). 107tests. verify-report.md                     |
| F006 | Security Guardrails       | completed   | T2   | verified    | main                    | SC 8/8 런타임(demo CI), 61 unit tests, 168 total. verify-report.md PASS |                                                                           |
| F007 | Admin Dashboard           | completed   | T2   | verified    | main                    | SC 16/16. Next.js+shadcn/ui+SSE. Playwright 런타임. P8-P11 skill feedback.                |
| F008 | Provider Fallback & LB    | completed   | T2   | verified    | main                    | SC 8/8 PASS. 서킷 브레이커+폴백+헬스API. P12/P13 skill feedback.                              |
| F009 | Knowledge Integration     | completed   | T3   | verified    | main                    | SC 9/9. pgvector RAG+MCP+BullMQ. Per-Task Micro-Verify 적용.                            |
| F010 | Prompt Management         | completed   | T3   | verified    | main                    | ⚠️ LIMITED. 14/14 SC code-level, 0/14 runtime. verify-report.md PARTIAL               |
| F011 | Semantic Cache            | in_progress | T3   | verify      | main                    |                                                                                       |
| F012 | Developer Playground      | pending     | T3   | pre-context | —                       |                                                                                       |


## Demo Groups


| DGID | Name                       | Features       | Scenario                             |
| ---- | -------------------------- | -------------- | ------------------------------------ |
| DG1  | Login → LLM → Budget Block | F002+F003+F004 | 로그인 → LLM 호출 → 예산 차감 → 예산 초과 차단(429) |
| DG2  | Auth → Logging & Tracing   | F003+F005      | 인증 요청 → 로깅+추적 (trace ID 전파 확인)       |


## 도구 체인


| Tool  | Status | Command                                         | Notes                           |
| ----- | ------ | ----------------------------------------------- | ------------------------------- |
| Build | 사용 가능  | `npm run build` (nest build api, webpack)       |                                 |
| Test  | 사용 가능  | `npm test` (jest)                               | 107개 테스트, 16개 스위트               |
| Lint  | 사용 가능  | `npm run lint` (eslint v10 + typescript-eslint) | eslint.config.mjs, 에러 0건 경고 35건 |


## Feature Detail Log

### F010-prompt-management

| Step | Status | Started | Completed | Notes |
|------|--------|---------|-----------|-------|
| specify | completed | 2026-03-27 | 2026-03-27 | 14 FR, 14 SC, 5 US. AbTest/AbTestVariant/PromptUsageStat 엔티티 추가 |
| plan | completed | 2026-03-27 | 2026-03-27 | 5 엔티티, 12 API, 13 소스파일 |
| tasks | completed | 2026-03-27 | 2026-03-27 | 13 tasks, 8 phases |
| analyze | completed | 2026-03-27 | 2026-03-27 | PASS. 0 CRITICAL, 1 MINOR WARNING |
| implement | completed | 2026-03-27 | 2026-03-27 | 15파일, 178 tests(+10). Build PASS |
| verify | completed | 2026-03-27 | 2026-03-27 | ⚠️ LIMITED — DB/Redis 미가동. 14/14 SC code-level ✅, 0/14 runtime. verify-report.md PARTIAL |
| merge | completed | 2026-03-27 | 2026-03-27 | main 직접 커밋 (CLAUDE.md: no branches) |

### F011-semantic-cache

| Step | Status | Started | Completed | Notes |
|------|--------|---------|-----------|-------|
| specify | completed | 2026-03-27 | 2026-03-27 | 12 FR, 11 SC, 4 US. CachePolicy 신규 엔티티 추가 |
| plan | completed | 2026-03-27 | 2026-03-27 | 2 엔티티, 4 API, 12 소스파일 |
| tasks | completed | 2026-03-27 | 2026-03-27 | 9 tasks, 8 phases |
| analyze | completed | 2026-03-27 | 2026-03-27 | PASS. spec↔plan↔tasks 일관성 확인 |
| implement | completed | 2026-03-27 | 2026-03-27 | 12파일, 185 tests(+7). Build PASS. CacheInterceptor→F002 GatewayController 적용 |
| verify | completed | 2026-03-28 | 2026-03-28 | ⚠️ LIMITED. 11/11 SC code-level ✅, 0/11 runtime. ↩️ SC-011 regression→fix. verify-report.md PARTIAL |
| merge | pending | | | |
