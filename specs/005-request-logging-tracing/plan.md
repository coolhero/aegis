# Implementation Plan: F005 — Request Logging & Tracing

**Branch**: `005-request-logging-tracing` | **Date**: 2026-03-26 | **Spec**: `specs/005-request-logging-tracing/spec.md`
**Input**: Feature specification from `/specs/005-request-logging-tracing/spec.md`

## Summary

모든 LLM 요청의 메타데이터(모델, 프로바이더, 토큰, 비용, 레이턴시)를 비동기적으로 로깅하고, Langfuse 통합 + OpenTelemetry 분산 트레이싱을 제공하며, 로그 조회/분석 API를 구현한다. BullMQ 큐를 통한 비동기 처리로 API 응답 성능을 격리한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS 10.x, TypeORM, BullMQ, langfuse-node, @opentelemetry/api
**Storage**: PostgreSQL (request_logs 테이블)
**Testing**: Jest + Supertest
**Target Platform**: Linux server (Docker)
**Project Type**: NestJS monorepo (apps/api)
**Performance Goals**: 로깅이 API 응답 시간에 5ms 이상 영향 미치지 않을 것
**Constraints**: 로그 append-only (수정/삭제 불가), 테넌트 격리 필수
**Scale/Scope**: MVP — 일 수만 건 수준

## Constitution Check

*GATE: Pass ✅*

| Principle | Status | Notes |
|-----------|--------|-------|
| Tenant Data Isolation | ✅ | org_id FK + TenantContext 필터 |
| Audit Trail | ✅ | 이 Feature 자체가 감사 추적 구현 |
| Streaming-First | ✅ | 스트리밍 완료 후 누적 토큰 로깅 |
| Start Simple (YAGNI) | ✅ | PostgreSQL GROUP BY, 전용 OLAP 미도입 |
| Test-First | ✅ | 테스트 우선 작성 |
| Demo-Ready | ✅ | demos/F005-logging.sh 제공 |

## Project Structure

### Documentation (this feature)

```text
specs/005-request-logging-tracing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── logs.contract.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/src/logging/
├── logging.module.ts              # NestJS 모듈 (imports, providers, exports)
├── entities/
│   └── request-log.entity.ts      # RequestLog TypeORM 엔티티
├── dto/
│   ├── log-query.dto.ts           # GET /logs 쿼리 파라미터 DTO
│   └── analytics-query.dto.ts     # GET /analytics/* 쿼리 파라미터 DTO
├── request-logger.interceptor.ts  # NestJS Interceptor — 요청 캡처 + BullMQ enqueue
├── logging.service.ts             # RequestLog CRUD + 분석 쿼리
├── logging.controller.ts          # GET /logs, GET /logs/:id
├── analytics.controller.ts        # GET /analytics/usage, GET /analytics/cost
├── logging-queue.processor.ts     # BullMQ 워커 — DB 쓰기 + Langfuse 전송
├── langfuse.service.ts            # Langfuse SDK 래퍼 (fire-and-forget)
├── log-retention.service.ts       # @Cron 보관 정리
└── logging.constants.ts           # 큐 이름, 기본값 상수
```

**Structure Decision**: NestJS module-per-domain 패턴 유지. `logging/` 모듈이 인터셉터, 서비스, 컨트롤러를 캡슐화.

## Architecture

### 데이터 흐름

```
Client → POST /v1/chat/completions
  │
  ├─ AuthGuard (F003) → TenantContext 설정
  ├─ BudgetGuard (F004) → 예산 체크
  │
  ├─ GatewayController (F002) → 프로바이더 호출
  │   │
  │   └─ RequestLoggerInterceptor (F005)
  │       ├─ [Before] startedAt 기록, trace_id 추출
  │       ├─ [After] 응답 캡처 → BullMQ enqueue (비동기)
  │       └─ [Error] 에러 캡처 → BullMQ enqueue (비동기)
  │
  └─ Response → Client (로그 쓰기 대기하지 않음)

BullMQ Worker (비동기):
  ├─ RequestLog DB 쓰기
  ├─ Langfuse trace + generation 전송 (fire-and-forget)
  └─ 실패 시 3회 재시도 → DLQ
```

### 핵심 컴포넌트

1. **RequestLoggerInterceptor**: `NestInterceptor` 구현. `POST /v1/chat/completions`에 적용. 요청 전후 타이밍 측정, 응답에서 토큰/에러 추출, BullMQ에 로그 데이터 enqueue.

2. **LoggingQueueProcessor**: BullMQ `@Processor('request-log')`. 큐에서 로그 데이터를 꺼내 RequestLog DB 삽입 + Langfuse 전송. 실패 시 3회 재시도, DLQ 저장.

3. **LangfuseService**: `langfuse-node` SDK 래퍼. `createTrace()` + `createGeneration()` 호출. 연결 실패 시 경고 로그만 기록하고 예외 전파 안 함.

4. **LoggingService**: RequestLog 조회/분석. 테넌트 필터 자동 적용. PostgreSQL `GROUP BY` + `DATE_TRUNC` 분석 쿼리.

5. **LogRetentionService**: `@Cron('0 3 * * *')` — 매일 03:00 UTC. Organization.settings.logRetentionDays (기본 90) 기준으로 오래된 로그 배치 삭제.

### 비용 계산 로직

```typescript
// Model 엔티티에서 가격 조회 (F002)
const model = await modelRepo.findOne({ where: { name: requestModel } });
const costUsd = model
  ? model.inputPricePerToken * inputTokens + model.outputPricePerToken * outputTokens
  : 0;
```

### 토큰 추정 폴백

프로바이더 응답에 `usage` 필드가 없는 경우:
1. `tiktoken` 등 토크나이저로 input/output 문자열 기반 추정
2. `estimated: true` 플래그 설정
3. 비용은 추정 토큰으로 계산

### 인메모리 폴백 버퍼

```typescript
// Redis/BullMQ 연결 실패 시
private fallbackBuffer: LogData[] = [];
private readonly MAX_BUFFER_SIZE = 1000;

onQueueError() {
  // 버퍼에 저장
}

onQueueReady() {
  // 버퍼 flush → 큐로 전송
}
```

## Complexity Tracking

> 위반 사항 없음 — Constitution Check 통과
