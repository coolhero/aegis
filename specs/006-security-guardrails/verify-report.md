# Verify Report: F006 — Security Guardrails

**Date**: 2026-03-26
**Branch**: `006-security-guardrails`
**Overall**: ✅ PASS

## Phase 1: Build + Test + Lint

| Check | Result | Details |
|-------|--------|---------|
| Build | ✅ PASS | `npm run build` → webpack compiled successfully |
| Test | ✅ PASS | 23 suites, 168 tests passed (F006: 7 suites, 61 tests) |
| Lint | ✅ PASS | 0 errors, 146 warnings (pre-existing, non-blocking) |

## Phase 2: Code Review

- SecurityGuard: NestJS Guard, 인젝션 탐지 + 바이패스 체크 ✅
- GuardInterceptor: 입력 PII 마스킹 + 출력 필터링 ✅
- GuardPipelineService: injection → PII → content 순서 오케스트레이션 ✅
- StreamingFilter: 50자 버퍼 윈도우, PG-003/PG-005 방지 ✅
- SecurityPolicyService: Redis 캐싱 (TTL 5분), 기본 정책 ✅
- SecurityPolicyController: JwtAuthGuard + RolesGuard, Admin-only PUT ✅
- Fail-closed: 스캐너 에러 시 요청 차단 ✅

## Phase 3: Runtime SC Verification

| SC | Description | Method | Result |
|----|-------------|--------|--------|
| SC-001 | Email masking | Unit test (pii.scanner.spec) | ✅ |
| SC-002 | Phone masking | Unit test (pii.scanner.spec) | ✅ |
| SC-003 | SSN masking | Unit test (pii.scanner.spec) | ✅ |
| SC-004 | Injection block → 403 | Runtime: POST /v1/chat/completions → 403 + `prompt_injection_detected` | ✅ |
| SC-005 | Base64 encoding detection | Unit test (normalizer.spec) | ✅ |
| SC-006 | False positive pass | Runtime: allowlisted phrase passed security, hit budget (separate) | ✅ |
| SC-007 | GET /security-policies/:orgId → 200 | Runtime: 200 + 기본 정책 JSON 반환 | ✅ |
| SC-008 | PUT policy → update reflected | Runtime: 200 + bypass_roles=["admin"] 반영 | ✅ |
| SC-009 | Member PUT → 403 | Runtime: 403 Insufficient permissions | ✅ |
| SC-010 | Output PII masking | Unit test (guard-pipeline.service.spec) | ✅ |
| SC-011 | Streaming PII boundary | Unit test (streaming-filter.spec) | ✅ |
| SC-012 | Bypass → GuardResult bypass | Unit test (security.guard.spec) | ✅ |
| SC-013 | Fail-closed on scanner error | Unit test (guard-pipeline.service.spec) | ✅ |
| SC-014 | Pipeline latency measurement | Unit test + DB GuardResult.latency_ms confirmed | ✅ |
| SC-015 | Default policy for new org | Runtime: GET returns default policy (id=null) | ✅ |
| SC-016 | Mask-then-log | Unit test (security.guard.spec: message replacement) | ✅ |
| SC-017 | Build compiles | `npm run build` → success | ✅ |

**Runtime SC (직접 서버 실행)**: SC-004, SC-006, SC-007, SC-008, SC-009, SC-015 — 6/17 런타임 검증
**Unit test SC**: SC-001~003, SC-005, SC-010~014, SC-016, SC-017 — 11/17 단위 테스트 검증

## Phase 4: GuardResult DB Evidence

```sql
SELECT scanner_type, decision, details FROM guard_results ORDER BY created_at DESC LIMIT 4;

 scanner_type | decision | details
--------------+----------+---
 content      | pass     | {"scanned": true, "categoriesChecked": 4}
 pii          | pass     | {"scanned": true, "detected": []}
 injection    | pass     | {"scanned": true, "allowlisted": true}
 injection    | block    | {"pattern": "ignore...", "confidence": 0.95}
```

## Phase 5: Demo Script (CI Mode)

`demos/F006-security-guardrails.sh --ci` 실행 결과:

| Check | Result |
|-------|--------|
| SC-004: Injection → 403 | ✅ |
| SC-006: False positive → non-403 | ✅ (429 — budget, not security block) |
| SC-007: GET policy → 200 | ✅ |
| SC-008: PUT policy → update | ✅ |
| SC-009: Member PUT → 403 | ✅ |
| SC-015: Default policy → injection=true | ✅ |
| SC-017: Build compiles | ✅ |
| DB: GuardResult records | ✅ (16 records) |

**Demo CI: 8/8 checks passed**

## Notes

- SC-001~003 (PII 마스킹): 런타임 검증에는 LLM Provider API Key 필요. 단위 테스트로 마스킹 로직 검증 완료. SecurityGuard가 메시지를 마스킹 버전으로 교체하는 것까지 확인.
- Guard 실행 순서: ApiKeyAuthGuard → SecurityGuard → BudgetGuard 로 변경 (인젝션을 예산 전에 차단)
- SecurityPolicyController: JWT 인증 사용 (다른 관리 API와 동일 패턴)
- Demo script: interactive 모드에서 5가지 시연 명령 제공, CI 모드에서 자동 검증
