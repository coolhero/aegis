# F004 Token Budget Management — Verify Report

**Date**: 2026-03-26
**Result**: ✅ PASS (Limited) — 13/20 SC 런타임 검증 완료

## Summary

| 항목 | 값 |
|------|-----|
| Build | ✅ 0 errors |
| Test | ✅ 37/37 passed (6 suites) |
| Lint | 35 warnings (기존), 0 errors |
| SC 런타임 | 13/20 (65%) |
| SC 구현 완료 | 20/20 (100%) |

## SC Verification Results

| SC | 결과 | 검증 방법 |
|----|------|-----------|
| SC-001 | ✅ Runtime | `PUT /budgets/org/:orgId` → 200 + Budget + BudgetPeriod 자동 생성 |
| SC-002 | ✅ Runtime | `PUT /budgets/team/:id`, `/user/:id` → 200 |
| SC-003 | ✅ Runtime | 실제 GPT-4o 호출 → 200 + 토큰 차감 (18 tokens) |
| SC-004 | ✅ Runtime | 예산 10 토큰 → LLM 요청 → 429 budget_exceeded |
| SC-005 | ⚠️ Code | Team 레벨 차단 로직 구현 (Lua script User→Team→Org 순차 검증) |
| SC-006 | ⚠️ Code | Redis Lua script 원자적 처리 (동시성 부하 테스트 미수행) |
| SC-007 | ⚠️ Code | `release()` 구현, GatewayController catch 블록에서 호출 |
| SC-008 | ⚠️ Code | BudgetAlertService 구현, Redis dedup + AlertRecord unique |
| SC-009 | ⚠️ Code | Redis EXISTS + DB unique constraint로 중복 방지 |
| SC-010 | ⚠️ Code | BudgetResetProcessor (BullMQ monthly cron) |
| SC-011 | ✅ Runtime | `GET /budgets/org/:id` → 계층 데이터 + 기간 사용량 반환 |
| SC-012 | ✅ Runtime | viewer(member) `PUT /budgets/org/:id` → 403 Forbidden |
| SC-013 | ✅ Runtime | `docker stop aegis-redis` → LLM 요청 → 503 Service Unavailable |
| SC-014 | ⚠️ Code | `reconcile()` 구현, estimated vs actual 차이 보정 로직 |
| SC-015 | ⚠️ Code | `sendWebhookWithRetry()` 3회 exponential backoff, webhook_status 갱신 |
| SC-016 | ✅ Runtime | `POST /model-tiers` → 201 + premium 티어 + GPT-4o/Claude Sonnet 할당 |
| SC-017 | ✅ Runtime | 동일 User에 global(200K tokens) + premium(5K tokens) 독립 Budget 생성 |
| SC-018 | ✅ Runtime | GPT-4o(premium) → 200 + 티어별+global 동시 차감 |
| SC-019 | ✅ Runtime | premium 소진 → GPT-4o 429 + tier 정보, gpt-4o-mini 200 성공 |
| SC-020 | ✅ Runtime | gpt-4o-mini(티어 미할당) → global 예산만 차감, 200 성공 |

## Bugs Found & Fixed During Verify

| # | 설명 | 수정 |
|---|------|------|
| 1 | TypeORM nullable column `string \| null` → "Data type Object" | `type: 'varchar'` 명시 |
| 2 | ioredis ESM/CJS 래퍼에서 `redis.status` 접근 불가 | `redis.ping()` 기반 확인으로 변경 |
| 3 | `request_id` non-UUID → DB insert 실패 | `randomUUID()` 사용 |
| 4 | `model_id` UUID 타입 but 모델명 전달 | `varchar(255)`로 변경 |
| 5 | Lua 파일 webpack 번들 미포함 | 인라인 문자열로 변경 |
| 6 | `resolveTierForModel` UUID vs 모델명 불일치 | models 테이블 JOIN 쿼리로 수정 |

## Cross-Feature Integration

| Feature | 통합 포인트 | 결과 |
|---------|------------|------|
| F001 | ConfigModule, DatabaseModule, RedisModule | ✅ |
| F002 | GatewayController + BudgetGuard 통합 | ✅ |
| F003 | JwtAuthGuard + RolesGuard + RBAC | ✅ |
