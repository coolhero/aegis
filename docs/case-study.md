# AEGIS Case Study: Enterprise AI Support Platform
## spec-kit-skills Greenfield Workflow — Full Process Record

> **Project**: AEGIS (AI Enterprise Gateway & Intelligence System)
> **Type**: Greenfield
> **Started**: 2026-03-25
> **Tool**: spec-kit-skills (smart-sdd + domain-extend)
> **Author**: coolhero

---

## Table of Contents

1. [Phase 0: Ideation & Market Research](#phase-0-ideation--market-research)
2. [Phase 1: Domain Analysis & Custom Module Creation](#phase-1-domain-analysis--custom-module-creation)
3. [Phase 2: Project Initialization (smart-sdd init)](#phase-2-project-initialization)
4. [Phase 3: Feature Definition (smart-sdd add)](#phase-3-feature-definition)
5. [Phase 4: Pipeline Execution (smart-sdd pipeline)](#phase-4-pipeline-execution)
6. [Appendix: Skill Feedback Log](#appendix-skill-feedback-log)

---

## Phase 0: Ideation & Market Research

### 0.1 Project Vision

**한 줄 요약**: 기업이 LLM을 안전하고 효율적으로 사용할 수 있게 해주는 셀프호스팅 가능한 AI 게이트웨이 플랫폼

**Problem Statement**:
- 기업들이 LLM API를 도입하려 하지만, 보안(프롬프트 인젝션, PII 유출), 비용 관리(팀별/사용자별 토큰 예산), 내부 지식 통합(RAG 성능 문제) 등의 문제로 도입이 지연되고 있음
- 기존 솔루션들은 게이트웨이(LiteLLM, Portkey), 보안(LLM Guard), 관찰성(Langfuse) 등 개별 영역만 해결하며, 이를 조합하려면 상당한 엔지니어링 노력이 필요

**Solution**: 하나의 셀프호스팅 플랫폼으로 LLM 라우팅 + 멀티테넌시 + 보안 가드레일 + 지식 통합 + 거버넌스를 통합 제공

### 0.2 Competitive Landscape (2026-03-25 기준)

#### 오픈소스 게이트웨이

| Solution | Strengths | Weaknesses | Stars |
|----------|-----------|------------|-------|
| **LiteLLM** | 100+ 프로바이더, 완전 오픈소스 | 메모리 누수, 대규모 레이턴시 이슈 | 18K+ |
| **Helicone** | Rust 기반 8ms P50, 우수한 관찰성 | 거버넌스/보안 약함 | - |
| **Bifrost** | <11μs 오버헤드, LiteLLM 대비 50x 빠름 | 프로바이더 20개로 제한 | - |

#### 상용 솔루션

| Solution | Pricing | Key Feature | Limitation |
|----------|---------|-------------|------------|
| **Portkey** | $49/mo+ | 1,600+ LLM, 거버넌스 | 제한된 셀프호스팅 |
| **Kong AI Gateway** | Enterprise | Portkey 대비 65% 낮은 레이턴시 | AI 특화 기능 부족 |
| **TrueFoundry** | Enterprise | 4-tier 계층적 예산 | 지식 통합 없음 |

#### 시장 Gap 분석

```
현재 시장에서 어떤 단일 플랫폼도 다음을 모두 제공하지 않음:
  ✗ 고성능 LLM 라우팅
  ✗ 멀티테넌트 비용 격리
  ✗ 보안 가드레일 (OWASP LLM Top 10)
  ✗ 기업 내부 지식 통합
  ✗ 셀프호스팅 가능

→ AEGIS의 포지셔닝: 이 5가지를 단일 오픈소스 플랫폼으로 제공
```

### 0.3 Knowledge Integration Trends (RAG 이후)

| Approach | Maturity | Accuracy | Cost | Best For |
|----------|----------|----------|------|----------|
| **Naive RAG** | Dead | 60-75% | Low | ❌ 프로덕션 부적합 |
| **Agentic RAG** | Production | 85-95% | Medium | 복합 질의, 다단계 추론 |
| **GraphRAG** | Experimental | 60-85% | 3-5x | 관계 추론 (조직도, 규정) |
| **MCP Tool Use** | Standard | N/A | Low | 실시간 구조화 데이터 |
| **Long Context** | Production | 90%+ | High | 소규모 코퍼스 직접 주입 |

**AEGIS 전략: Hybrid Router**
- 쿼리 타입에 따라 Agentic RAG / MCP / Long Context 중 최적 전략 자동 선택
- MCP가 2026년 사실상 표준 ("AI의 USB-C") — OpenAI, Microsoft, Anthropic 모두 채택
- GraphRAG는 T3 (향후 확장)로 분류

### 0.4 Security Landscape (OWASP LLM Top 10, 2025)

| # | Category | Severity | AEGIS 대응 |
|---|----------|----------|-----------|
| LLM01 | Prompt Injection | Critical | Input scanner + 시스템 프롬프트 격리 |
| LLM02 | Sensitive Data Disclosure | High | PII 마스킹 (input/output) |
| LLM03 | Supply Chain Vulnerabilities | High | 모델 허용 목록 |
| LLM05 | Improper Output Handling | High | Output validator |
| LLM06 | Excessive Agency | Medium | Per-tenant agency 제어 |
| LLM07 | System Prompt Leakage | Medium | 시스템 프롬프트 분리 저장 |
| LLM10 | Unbounded Consumption | Medium | Token budget 강제 |

**방어 아키텍처**: Multi-layered (Input Scanner → LLM → Output Validator)
- 오픈소스 기반: LLM Guard (MIT, 15 input/20 output scanners)
- 선택적 강화: Lakera Guard (98%+ 탐지율, 50ms 미만)

### 0.5 Enterprise Governance

**EU AI Act**: 2026년 8월 2일 고위험 조항 전면 적용 — 5개월 남음
- 위반 시 3,500만 EUR 또는 글로벌 매출 7% 벌금
- 기업들이 이미 EU AI Act 준수 기준으로 벤더 평가 중

**필수 거버넌스 요소**:
1. **감사 추적**: 모든 LLM 인터랙션의 전체 의사결정 계보 기록
2. **접근 제어**: RBAC + 팀별 모델 접근 정책
3. **비용 귀속**: 멀티테넌트 비용 추적 (Org > Team > Project > User)
4. **데이터 보호**: 데이터 최소화, 보존 정책, 옵트아웃
5. **관찰성**: Langfuse (MIT, 19K+ stars, 셀프호스팅) 기반

### 0.6 Architecture Decisions

#### Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | **TypeScript** | 프론트엔드/백엔드 통합, 타입 안전성 |
| Backend | **NestJS** | 엔터프라이즈급 DI, 모듈 시스템, Guards/Interceptors |
| DB | **PostgreSQL + pgvector** | 관계형 + 벡터 검색 통합 |
| Cache | **Redis** | 세션, 토큰 한도, 시맨틱 캐시 |
| Queue | **BullMQ** | 비동기 작업 (임베딩 생성, 로깅) |
| Frontend | **Next.js** | 관리 대시보드, 플레이그라운드 |
| Observability | **Langfuse** | 오픈소스 LLM 관찰성 |

#### Feature Tiers

| Tier | Features | Priority |
|------|----------|----------|
| **T0** | Foundation Setup (NestJS + PostgreSQL + Redis) | Base |
| **T1** | LLM Gateway Core, Auth & Multi-tenancy, Token Budget, Request Logging | MVP |
| **T2** | Knowledge Integration, Security Guardrails, Admin Dashboard, Fallback/LB | Phase 2 |
| **T3** | Prompt Management, Semantic Cache, Developer Playground | Phase 3 |

### 0.7 Domain Profile (for spec-kit-skills)

```yaml
Interfaces:  [http-api, gui]
Concerns:    [auth, multi-tenancy, resilience, observability,
              realtime, stream-processing, external-sdk,
              token-budget*, prompt-guard*]
Archetype:   [ai-gateway*]
Foundation:  typescript + nestjs
Context:     greenfield | mvp × small-team

# * = custom modules (spec-kit 내장 모듈에 없음 → /domain-extend로 생성 필요)
```

**Custom Module 필요성 분석**:

1. **ai-gateway** (Archetype): 내장 `ai-assistant`는 "LLM 소비자" 관점. AEGIS는 "LLM 관리자" 관점 필요
   - Provider Abstraction, Streaming-First, Token-Aware Routing, Multi-tenant Isolation

2. **token-budget** (Concern): 내장 `resilience`는 flat rate-limit. AEGIS는 계층적 예산 필요
   - Org > Team > User 계층, tokens+cost 이중 추적, hard/soft limit

3. **prompt-guard** (Concern): LLM 보안은 일반 보안과 다름
   - PII 순서, 인코딩 우회, 스트리밍 필터 타이밍

### 0.8 Execution Plan

```
Phase 0: ✅ Market Research & Ideation (this document)
Phase 1: → git init, CLAUDE.md, /domain-extend (3 custom modules)
Phase 2: → /smart-sdd init (Proposal Mode)
Phase 3: → /smart-sdd add (Feature definitions)
Phase 4: → /smart-sdd pipeline (T0+T1 Features)
Phase 5: → Case Study finalization (EN + KO)
```

---

## Phase 1: Domain Analysis & Custom Module Creation

> Status: ✅ COMPLETED (2026-03-25)

### 1.1 Gap Analysis Process

**Method**: Description-based detection (no code, no sdd-state.md — greenfield project)

**Input**: AEGIS 프로젝트 설명을 `_taxonomy.md`의 58개 Concern + 14개 Archetype + 10개 Interface 모듈과 대조

**Coverage Results**:
- **12개 Built-in 모듈**: 직접 매핑됨 (auth, authorization, multi-tenancy, resilience, observability, realtime, stream-processing, external-sdk, audit-logging, compliance, llm-agents, content-moderation)
- **3개 Gap 발견**: AEGIS 고유 패턴이 기존 모듈로 커버 불가

| Gap | Closest Module | Similarity | Gap Reason |
|-----|---------------|------------|------------|
| AI Gateway 라우팅 | ai-assistant (15%) | LLM 소비자 vs 관리자 관점 차이 |
| 계층적 토큰 예산 | resilience (20%) | flat rate-limit vs 계층적 토큰+비용 |
| 프롬프트 보안 | content-moderation (25%) | UGC 리뷰 큐 vs 인라인 LLM 보안 |

### 1.2 Custom Module Creation (via /domain-extend extend)

#### Module 1: ai-gateway (Archetype)
- **File**: `specs/domains/archetypes/ai-gateway.md`
- **A0 Keywords**: 10 primary (LLM gateway, AI gateway, LLM proxy...) + 10 secondary
- **A1 Principles**: 5개
  1. Provider Abstraction — 통합 인터페이스, 직접 SDK 호출 금지
  2. Streaming-First — SSE 토큰 단위 프록시, 버퍼링 금지
  3. Token-Aware Routing — 예산 기반 라우팅 결정
  4. Multi-tenant Isolation — 테넌트별 완전 격리
  5. Audit Everything — 포렌식 수준 로깅
- **A2 SC Rules**: 5 required patterns + 4 anti-patterns
- **A3 Probes**: 6 sub-domains
- **A4 Constitution**: 5 principles
- **A5 Completion**: 5 criteria
- **S7 Failures**: AG-001~005 (cascade, streaming mismatch, tenant bypass, race condition, fallback loop)

#### Module 2: token-budget (Concern)
- **File**: `specs/domains/concerns/token-budget.md`
- **S0 Keywords**: 10 primary + 12 secondary
- **S1 SC Rules**: 5 required patterns (budget check flow, deduction atomicity, hierarchy, reset, alerts) + 4 anti-patterns
- **S5 Probes**: 6 sub-domains (granularity, metric, reset, hard/soft, carryover, emergency)
- **S7 Failures**: TB-001~005 (race condition, retry double-charge, streaming drift, reset race, hierarchy bypass)
- **S9 Criteria**: 4 required elements

#### Module 3: prompt-guard (Concern)
- **File**: `specs/domains/concerns/prompt-guard.md`
- **S0 Keywords**: 10 primary + 12 secondary
- **S1 SC Rules**: 5 required patterns (PII input/output, injection, content filter, privileged bypass) + 4 anti-patterns
- **S5 Probes**: 6 sub-domains (PII scope, action, injection defense, categories, false positives, audit)
- **S7 Failures**: PG-001~005 (mask-then-log, system prompt injection, partial PII streaming, encoding bypass, output filter race)
- **S9 Criteria**: 4 required elements

### 1.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| ai-gateway를 archetype으로 분류 (concern 아님) | Gateway는 프로젝트의 핵심 정체성. concern은 횡단 관심사지만 gateway는 시스템 아키타입 |
| token-budget을 resilience와 분리 | resilience는 일반적 장애 복원. Token budget은 LLM 특화 계층적 예산으로 S7 failure mode가 완전히 다름 |
| prompt-guard를 content-moderation과 분리 | content-moderation은 비동기 리뷰 큐. prompt-guard는 <100ms 인라인 처리 + LLM 특화 (인코딩 우회, 스트리밍 PII) |
| 프로젝트 로컬 모듈 (spec-kit 내장 아님) | AEGIS 전용 패턴. 범용성이 검증되면 추후 `--skill`로 기여 가능 |

### 1.4 Execution Plan Update

```
Phase 0: ✅ Market Research & Ideation
Phase 1: ✅ git init, CLAUDE.md, /domain-extend (3 custom modules)
Phase 2: ✅ /smart-sdd init (Proposal Mode, CI 97%)
Phase 3: ✅ /smart-sdd add (12 Features, T0~T3)
Phase 4: → /smart-sdd pipeline (T0+T1 Features)
Phase 5: → Case Study finalization (EN + KO)
```
- **A3**: 6 probes (Providers, Routing, Streaming, Budget, Audit, SLA)
- **A4**: 5 constitution principles
- **A5**: 5 brief criteria

#### 2. token-budget (Concern)
- **S1**: Budget check flow, deduction atomicity, reset, alerts, hierarchy
- **S5**: 6 probes (Granularity, metric, reset, hard/soft, carryover, emergency)
- **S7**: TB-001~005 (race condition, retry double-charge, streaming count, reset timing, hierarchy bypass)

#### 3. prompt-guard (Concern)
- **S1**: PII detection, injection detection, content filtering, privileged bypass
- **S5**: 6 probes (PII scope, action, injection defense, categories, false positives, audit)
- **S7**: PG-001~005 (mask-then-log, system prompt injection, partial PII, encoding bypass, output filter race)

---

## Phase 2: Project Initialization (smart-sdd init)

> Status: ✅ COMPLETED (2026-03-25)

### 2.1 Init Mode Selection

**Input**: Idea string ("AEGIS — Enterprise AI Support Platform...")
**Mode**: Proposal Mode (idea string triggers automatic Proposal generation)

### 2.2 Signal Extraction + CI Scoring

**Method**: S0/A0 keyword matching against 58 Concern + 14 Archetype + 10 Interface modules

**CI Score: 97% (35/36) — Rich Tier**

| Dimension | Weight | Confidence | Points | Evidence |
|-----------|--------|------------|--------|----------|
| Core Purpose | ×3 | 3 | 9 | "Enterprise AI gateway" — 명확한 문제/솔루션 |
| Key Capabilities | ×3 | 3 | 9 | 5개 주요 기능 명시적으로 나열 |
| Project Type | ×2 | 3 | 6 | HTTP API + GUI (admin dashboard) |
| Tech Stack | ×1 | 3 | 3 | TS, NestJS, Next.js, PG, Redis 완전 명시 |
| Target Users | ×1 | 2 | 2 | Enterprise teams 암시, 명시적이지 않음 |
| Scale & Scope | ×1 | 3 | 3 | "MVP, small team, self-hosted" |
| Constraints | ×1 | 3 | 3 | OWASP LLM Top 10, EU AI Act |

**Routing**: Rich (≥70%) → Proposal 바로 생성 (clarification 스킵)

### 2.3 Module Signal Matches

| Module | Match Type | Matched Keywords |
|--------|-----------|-----------------|
| http-api | Interface (S0) | REST API, endpoints |
| gui | Interface (S0) | admin dashboard, Next.js |
| auth | Concern (S0) | RBAC, JWT |
| multi-tenancy | Concern (S0) | multi-tenant, Org>Team>User |
| resilience | Concern (S0) | fallback, circuit breaker |
| observability | Concern (S0) | audit trails |
| realtime | Concern (S0) | SSE streaming |
| stream-processing | Concern (S0) | streaming proxy |
| external-sdk | Concern (S0) | LLM provider SDKs |
| audit-logging | Concern (S0) | audit trails |
| compliance | Concern (S0) | EU AI Act, OWASP |
| ai-gateway* | Archetype (A0) | LLM gateway, routing, proxy |
| token-budget* | Concern (S0) | token budget, hierarchical |
| prompt-guard* | Concern (S0) | prompt injection, PII masking |

`*` = project-local custom modules

### 2.4 Proposal Generation + Approval

**Proposal CI**: 97% (Rich) → 즉시 생성
**Feature Catalog**: 12 Features across 4 tiers (T0: 1, T1: 4, T2: 3, T3: 4)
**User Decision**: "Approve and continue" — 수정 없이 승인

### 2.5 Constitution Seed

**Best Practices**: 6개 전체 채택
**Signal-Driven Principles**: 9개 (Tenant Data Isolation, Streaming-First, Model Agnosticism 등)
**Custom Principles**: 없음
**User Decision**: "Approve as-is" — 수정 없이 승인

### 2.6 Generated Artifacts

| Artifact | Path | Content |
|----------|------|---------|
| sdd-state.md | specs/_global/ | Domain Profile, CI Score, Feature Progress (empty) |
| roadmap.md | specs/_global/ | Project Overview, Feature Catalog (empty) |
| constitution-seed.md | specs/_global/ | 9 Architecture Principles + 6 Best Practices + Tech Constraints |
| entity-registry.md | specs/_global/ | Empty (populated during plan) |
| api-registry.md | specs/_global/ | Empty (populated during plan) |
| history.md | specs/ | Decision log for init session |

### 2.7 Observations

- **CI 97%는 매우 높은 수준**: 사전 리서치(Phase 0)를 충분히 했기 때문. 일반적인 "한 줄 아이디어" 입력 시 40-60% 대가 일반적
- **Signal-Driven Principles**: Domain Profile에서 활성화된 모듈의 S0 키워드가 CI 차원별로 매핑되어 원칙 자동 추천. 예: `multi-tenancy` 활성 → "Tenant Data Isolation" 자동 추천
- **Custom Module 효과**: ai-gateway, token-budget, prompt-guard의 S0 키워드가 시그널 추출에 참여하여 더 정확한 Domain Profile 구성

---

## Phase 3: Feature Definition (smart-sdd add)

> Status: ✅ COMPLETED (2026-03-25)

### 3.1 Entry Type

**Type**: Conversational (Type 2) — Proposal에서 제안된 12개 Feature를 기반으로 대화형 elaboration

### 3.2 Elaboration Process

**S5 Probes 활용**: Domain Profile에서 활성화된 모듈의 S5 Elaboration Probes로 핵심 결정사항 수집

| Feature | S5 Probe | Decision |
|---------|----------|----------|
| F001 Foundation Setup | 인프라 범위 | Standard NestJS: monorepo + PG + Redis + Docker Compose |
| F002 LLM Gateway Core | 프로바이더 전략 | OpenAI + Anthropic (2개로 시작, 확장 가능 구조) |
| F003 Auth & Multi-tenancy | 인증 방식 | API Key + JWT (OAuth는 향후 확장) |
| F006 Security Guardrails | 방어 수준 | LLM Guard (MIT 오픈소스) 기반 |
| F007 Admin Dashboard | UI 프레임워크 | Next.js + shadcn/ui + TanStack Query |
| F009 Knowledge Integration | 지식 통합 방식 | MCP + Vector RAG 하이브리드 |

### 3.3 Feature Catalog (12 Features, 4 Tiers)

| Tier | Count | Features |
|------|-------|----------|
| T0 | 1 | F001 Foundation Setup |
| T1 | 4 | F002 Gateway Core, F003 Auth, F004 Budget, F005 Logging |
| T2 | 3 | F006 Security, F007 Dashboard, F008 Fallback |
| T3 | 4 | F009 Knowledge, F010 Prompts, F011 Cache, F012 Playground |

### 3.4 Release Groups

| RG | Features | Milestone |
|----|----------|-----------|
| RG1 | F001~F005 | Core Platform (MVP) |
| RG2 | F006~F008 | Enterprise Ready |
| RG3 | F009~F011 | Intelligence |
| RG4 | F012 | Developer Experience |

### 3.5 Generated Artifacts

- 12개 `pre-context.md` 파일 (specs/001-* ~ specs/012-*)
- `roadmap.md` 업데이트: Feature Catalog + Dependency Graph + Release Groups + Demo Groups
- `sdd-state.md` 업데이트: 12 Features (status: pending)
- `entity-registry.md` 업데이트: 20개 엔티티 (owner + fields + references)
- `api-registry.md` 업데이트: 모든 REST 엔드포인트 + Internal Services

### 3.6 Observations

- **6-Phase Briefing 간소화**: Greenfield 프로젝트이므로 Phase 2 (Overlap) 스킵, Phase 4 (SBI) 스킵
- **Batch Elaboration**: 12개 Feature를 개별이 아닌 배치로 처리하여 효율성 확보
- **Entity Registry 선행 작성**: plan 단계 전에 미리 20개 엔티티 정의 → specify/plan에서 참조 가능
- **API Registry 선행 작성**: Feature 간 API 계약 사전 정의 → cross-Feature 의존성 명확화
- **컨텍스트 관리**: G11 (3+ Features = context saturation) 주의사항을 인지하고 있으며, pipeline 실행 시 Feature별로 세션 분리 필요

---

## Phase 4: Pipeline Execution

> Status: PENDING — will be documented as /smart-sdd pipeline is executed

---

## Appendix: Skill Feedback Log

> Issues encountered during the process will be logged here and in `docs/skill-feedback.md`

---

*Last updated: 2026-03-25*
