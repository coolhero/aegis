# Constitution Seed — AEGIS

## Source Code Reference Principles

N/A — Greenfield project. No existing source code to reference.

## Architecture Principles

| Principle | Rationale |
|-----------|-----------|
| **Tenant Data Isolation** | 테넌트 간 데이터 유출 방지. 캐시 키, 로그, 에러 응답 모두 테넌트 격리 |
| **Streaming-First** | AI 게이트웨이에서 SSE 토큰 단위 프록시가 기본. 배치 모드는 예외적으로만 사용 |
| **Model Agnosticism** | 프로바이더 추상화 계층을 통해 모든 LLM 접근. 비즈니스 로직에서 직접 SDK 호출 금지 |
| **Contract Testing** | 외부 LLM API 연동에 계약 테스트 적용. 프로바이더 응답 스키마 변경 감지 |
| **Retry with Backoff** | 외부 API 장애 시 지수 백오프 + 지터. 재시도 예산 제한 |
| **Secure Token Storage** | API 키, JWT 등 암호화 저장. 환경 변수 또는 시크릿 매니저 사용 |
| **Audit Trail** | 모든 LLM 인터랙션의 포렌식 수준 로깅. 불변 감사 이벤트 |
| **EU AI Act Compliance** | 2026년 8월 고위험 조항 전면 적용 대비. 결정 계보 기록 |
| **Start Simple (YAGNI)** | MVP 단계에서 과잉 설계 방지. 필요할 때 확장 |

## Technical Constraints

| Constraint | Details |
|------------|---------|
| Language | TypeScript (프론트엔드/백엔드 통합) |
| Backend Framework | NestJS (엔터프라이즈급 DI, 모듈 시스템) |
| Frontend Framework | Next.js (관리 대시보드) |
| Database | PostgreSQL + pgvector (관계형 + 벡터 검색) |
| Cache/Queue | Redis + BullMQ (세션, 토큰 한도, 비동기 작업) |
| Observability | Langfuse (MIT, 셀프호스팅, OpenTelemetry 호환) |
| Security Standard | OWASP LLM Top 10 (2025) |
| Compliance | EU AI Act (2026-08-02 deadline) |

## Coding Conventions

| Convention | Details |
|------------|---------|
| Naming | camelCase (variables/functions), PascalCase (classes/interfaces), kebab-case (files) |
| Project Structure | NestJS module-per-domain pattern (one module per Feature) |
| Error Handling | NestJS Exception Filters, typed error codes, never expose internal errors |
| Testing | Jest + Supertest (unit + integration), Playwright (E2E) |

## Best Practices

### I. Test-First (NON-NEGOTIABLE)
테스트 먼저 작성. 테스트 없는 코드는 미완성.

### II. Think Before Coding
가정 금지. 불명확한 항목은 `[NEEDS CLARIFICATION]` 표시.

### III. Simplicity First
스펙에 있는 것만 구현. 추측성 추가 금지.

### IV. Surgical Changes
인접 코드 "개선" 금지. 본인 변경분만 정리.

### V. Goal-Driven Execution
검증 가능한 완료 기준 필수.

### VI. Demo-Ready Delivery
각 Feature 완료 시 데모 가능해야 함. 실행 가능한 데모 스크립트(`demos/F00N-name.sh`) 제공.

## Global Evolution Layer Operational Principles

1. **P1: Roadmap-Driven Ordering** — Feature 실행 순서는 roadmap.md의 Release Groups를 따름
2. **P2: Entity/API Registry as Contracts** — 레지스트리에 정의된 엔티티와 API는 계약으로 취급
3. **P3: File over Memory** — 모든 상태는 파일에 저장. 대화 컨텍스트에 의존하지 않음
4. **P4: Cross-Feature Awareness** — 각 Feature specify/plan 시 다른 Feature의 pre-context 참조
