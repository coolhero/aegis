# Implementation Plan: F008 — Provider Fallback & Load Balancing

**Branch**: `008-provider-fallback-lb` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)

## Summary

F002 LLM Gateway의 라우팅 로직을 확장하여 서킷 브레이커, 자동 폴백, 레이턴시 기반 라우팅, 가중 라운드로빈을 추가한다. 서킷 상태는 Redis에 저장 (멀티 인스턴스 동기화). 최대 2-hop 폴백 제한. 기존 GatewayController/ProviderRouter에 통합.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, ioredis, existing F002 Gateway module
**Storage**: Redis (circuit state, latency metrics), PostgreSQL (Provider entity extension)
**Testing**: Jest + Supertest
**Project Type**: Backend service extension (F002 모듈 확장)
**Performance Goals**: 폴백 결정 < 5ms, 서킷 상태 확인 < 1ms (Redis)
**Constraints**: 최대 2-hop, 비순환 폴백 체인, Redis 장애 시 인메모리 폴백

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| Provider Abstraction | ✅ ProviderRouter 확장, 직접 SDK 호출 없음 |
| Retry with Backoff | ✅ 서킷 브레이커 + 지수 백오프 (recovery_timeout) |
| Start Simple (YAGNI) | ✅ 서킷 브레이커 + 폴백 핵심만. 고급 기능(canary, A/B)은 미구현 |
| Tenant Data Isolation | ✅ 프로바이더 상태는 글로벌 (테넌트 무관) — 적절 |

## Project Structure

```text
specs/008-provider-fallback-lb/
├── plan.md              # This file
├── data-model.md        # Circuit breaker types
├── contracts/
│   └── health.contract.md
└── tasks.md

apps/api/src/gateway/
├── provider-router.service.ts     # 기존 파일 확장: 서킷 브레이커 + 폴백 로직
├── circuit-breaker.service.ts     # 신규: 서킷 브레이커 상태 관리 (Redis)
├── health-check.service.ts        # 신규: 주기적 헬스 프로브
├── health.controller.ts           # 신규: GET /providers/health
├── latency-tracker.service.ts     # 신규: 레이턴시 추적 (Redis SortedSet)
└── gateway.module.ts              # 기존 파일: 신규 서비스 등록
```

## Architecture

### 서킷 브레이커 상태 머신

```
CLOSED ──(failure_count >= threshold)──→ OPEN
   ↑                                       │
   │                               (recovery_timeout)
   │                                       ↓
   └──────(probe success)──────── HALF-OPEN
                                       │
                              (probe failure)
                                       ↓
                                     OPEN
```

### Redis 상태 저장

```
Hash: circuit:{provider_id}
  - state: "CLOSED" | "OPEN" | "HALF_OPEN"
  - failure_count: number
  - last_failure_at: ISO timestamp
  - opened_at: ISO timestamp (OPEN 전이 시각)

SortedSet: latency:{provider_id}
  - score: timestamp (ms)
  - member: latency_ms
  - TTL: 5분 윈도우 (ZREMRANGEBYSCORE로 만료 제거)
```

### 라우팅 결정 흐름

```
요청 도착 → model에서 가능한 프로바이더 목록 조회
  → 서킷 OPEN인 프로바이더 제외
  → 레이턴시/가중치 기반 정렬
  → 1순위 프로바이더 시도
     → 성공: 응답 반환 + 레이턴시 기록
     → 실패: failure_count++ → 서킷 체크 → 2순위 폴백 (hop 1)
        → 성공: X-Fallback-Provider 헤더 추가
        → 실패: 3순위 폴백 (hop 2)
           → 성공: X-Fallback-Provider 헤더
           → 실패: 503 + Retry-After
```

### 헬스체크 프로브 (Cron)

- 30초 간격으로 OPEN 상태 프로바이더에 경량 요청 전송
- 성공 → HALF-OPEN → 다음 실제 요청이 프로브 역할 → 성공 시 CLOSED
- NestJS `@Cron('*/30 * * * * *')` 데코레이터 사용

## Interaction Chains

N/A — 백엔드 전용 Feature (UI 없음)

## Integration Contracts

| Direction | Target Feature | Interface | Provider Shape | Consumer Shape |
|-----------|---------------|-----------|---------------|---------------|
| Consumes ← | F002 | ProviderAdapter.chat() | `ChatResponse` | `ChatResponse` |
| Consumes ← | F002 | ProviderRouter.route() | `Provider` | `Provider + CircuitState` |
| Provides → | F007 (향후) | GET /providers/health | `ProviderHealthDto[]` | — |
