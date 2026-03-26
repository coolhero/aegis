# Tasks: F008 — Provider Fallback & Load Balancing

**Feature**: F008 — Provider Fallback & Load Balancing
**Branch**: `008-provider-fallback-lb`
**Generated**: 2026-03-27
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Implementation Strategy

- **MVP**: Phase 1 (Setup) + Phase 2 (US1+US2 서킷 브레이커 + 폴백)
- **Full**: + Phase 3 (US3 헬스 API) + Phase 4 (US4 레이턴시 라우팅) + Phase 5 (Polish)

## Dependencies

```
Phase 1 (Foundation) → Phase 2 (US1+US2 — 서킷+폴백, 밀접 결합) → Phase 3 (US3) → Phase 4 (US4) → Phase 5 (Polish)
```

---

## Phase 1: Foundation

- [ ] T001 CircuitBreaker 서비스 — `apps/api/src/gateway/circuit-breaker.service.ts`: Redis Hash 기반 서킷 상태 관리. getState(), recordSuccess(), recordFailure(), isOpen(), transitionToHalfOpen(). failureThreshold=5, recoveryTimeout=30s. Redis 장애 시 인메모리 Map 폴백.
- [ ] T002 CircuitBreaker 단위 테스트 — `apps/api/src/gateway/circuit-breaker.service.spec.ts`: CLOSED→OPEN 전이 (5회 실패), OPEN→HALF_OPEN (30s 타임아웃), HALF_OPEN→CLOSED (성공), HALF_OPEN→OPEN (실패), Redis 장애 시 인메모리 동작
- [ ] T003 LatencyTracker 서비스 — `apps/api/src/gateway/latency-tracker.service.ts`: Redis SortedSet 기반 레이턴시 기록/조회. recordLatency(), getAvgLatency(), getErrorRate(). 5분 윈도우.
- [ ] T004 LatencyTracker 단위 테스트 — `apps/api/src/gateway/latency-tracker.service.spec.ts`: 레이턴시 기록, 평균 계산, 5분 윈도우 만료, 에러율 계산

---

## Phase 2: US1+US2 — 서킷 브레이커 + 자동 폴백 (P1)

**Goal**: 프로바이더 장애 시 서킷 OPEN + 자동 폴백(2-hop) + 503
**Independent Test**: 프로바이더 실패 주입 → 서킷 OPEN → 폴백 → 성공 / 전체 OPEN → 503

- [ ] T005 ProviderRouter 확장 — `apps/api/src/gateway/provider-router.service.ts`: 기존 라우팅 로직에 서킷 브레이커 통합. 서킷 OPEN 프로바이더 제외 → 폴백 체인(최대 2-hop) → 실패 시 recordFailure → 성공 시 recordSuccess + recordLatency. 폴백 시 X-Fallback-Provider 헤더 설정.
- [ ] T006 폴백 체인 비순환 검증 — `apps/api/src/gateway/provider-router.service.ts`: 폴백 체인 구성 시 순환 감지 (visited set). 순환 발견 시 경고 로그 + 순환 프로바이더 제외.
- [ ] T007 503 + Retry-After 응답 — `apps/api/src/gateway/provider-router.service.ts`: 모든 프로바이더 불가용 시 ServiceUnavailableException + Retry-After 헤더 (가장 빠른 recovery_timeout 기준).
- [ ] T008 서킷 상태 전이 로깅 — `apps/api/src/gateway/circuit-breaker.service.ts`: 상태 전이 시 Logger.warn() (provider, from_state, to_state, reason, timestamp).
- [ ] T009 ProviderRouter 통합 테스트 — `apps/api/src/gateway/provider-router.service.spec.ts`: (a) 정상 라우팅, (b) 1차 폴백 성공 + X-Fallback-Provider, (c) 2-hop 후 503, (d) 비순환 검증, (e) 서킷 OPEN 프로바이더 제외

---

## Phase 3: US3 — 헬스 상태 조회 (P2)

**Goal**: GET /providers/health API + 주기적 헬스 프로브
**Independent Test**: GET /providers/health → 프로바이더별 상태 JSON

- [ ] T010 [P] [US3] HealthCheck 서비스 — `apps/api/src/gateway/health-check.service.ts`: @Cron 30초 주기 헬스 프로브. OPEN 프로바이더에 경량 요청 → 성공 시 HALF_OPEN 전이.
- [ ] T011 [P] [US3] Health 컨트롤러 — `apps/api/src/gateway/health.controller.ts`: GET /providers/health. JwtAuthGuard. 프로바이더별 circuit_state, avg_latency_ms, error_rate, last_check_at, weight 반환.
- [ ] T012 [US3] Health 단위 테스트 — `apps/api/src/gateway/health.controller.spec.ts`: (a) 인증 → 프로바이더 목록, (b) OPEN 프로바이더 상태 반영, (c) 미인증 → 401

---

## Phase 4: US4 — 레이턴시 기반 라우팅 (P3)

**Goal**: 평균 레이턴시 낮은 프로바이더 우선 + 가중 라운드로빈
**Independent Test**: 레이턴시 차이 → 우선순위 변경, 가중치 → 트래픽 비율

- [ ] T013 [US4] 레이턴시 기반 정렬 — `apps/api/src/gateway/provider-router.service.ts`: 사용 가능한 프로바이더를 avgLatency 기준 정렬. 동일 레이턴시 시 weight 기반.
- [ ] T014 [US4] 가중 라운드로빈 — `apps/api/src/gateway/provider-router.service.ts`: weight 기반 확률적 선택. weight=3인 프로바이더가 weight=1보다 3배 선택.
- [ ] T015 [US4] 라우팅 단위 테스트 — `apps/api/src/gateway/provider-router.routing.spec.ts`: (a) 레이턴시 우선순위, (b) 가중치 비율, (c) 혼합 (레이턴시+가중치)

---

## Phase 5: Polish

- [ ] T016 Gateway 모듈 등록 — `apps/api/src/gateway/gateway.module.ts`: CircuitBreakerService, LatencyTrackerService, HealthCheckService, HealthController 등록. ScheduleModule import.
- [ ] T017 데모 스크립트 — `demos/F008-provider-fallback.sh`: API 서버 시작 → 프로바이더 상태 조회 → LLM 요청 (정상) → 프로바이더 비활성화 → 폴백 확인 → 서킷 상태 조회. --ci 모드.
- [ ] T018 Redis 장애 degraded mode 테스트 — Redis 미접속 상태에서 서킷 브레이커 인메모리 동작 확인

---

## Summary

| Phase | Tasks | Parallel | User Story |
|-------|-------|----------|------------|
| 1. Foundation | T001-T004 | T001+T003 | — |
| 2. US1+US2 Circuit+Fallback | T005-T009 | — | P1 |
| 3. US3 Health API | T010-T012 | T010+T011 | P2 |
| 4. US4 Latency Routing | T013-T015 | — | P3 |
| 5. Polish | T016-T018 | — | — |

**Total**: 18 tasks, 4 parallelizable
**MVP Scope**: Phase 1-2 (T001-T009, 9 tasks)
