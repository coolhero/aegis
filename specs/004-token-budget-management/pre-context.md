# Pre-Context: F004 — Token Budget Management

## Feature Summary
Org > Team > User 계층적 토큰/비용 이중 예산 관리. Redis 원자적 연산 기반 실시간 예산 체크, 하드/소프트 리밋, 월간 리셋 주기, 임계치 알림(80/90/100%)을 제공한다.

## User & Purpose
- **Actor(s)**: 조직 관리자 (예산 설정), 팀 리더 (팀 예산 모니터링), 개발자 (개인 사용량 확인)
- **Problem**: LLM 사용 비용이 통제 없이 증가하면 예산 초과 위험. 계층별 세분화된 예산 관리와 실시간 차단이 필요.
- **Key Scenarios**: 요청 전 예산 잔여량 확인 후 차단/허용, 월초 자동 리셋, 80% 도달 시 경고 알림, 팀 예산 소진 시 팀원 전원 차단

## Capabilities
- Org > Team > User 3단계 계층적 예산
- 토큰 수 + 금액(USD) 이중 추적
- Redis Lua 스크립트 기반 원자적 예산 체크 & 차감
- 하드 리밋 (초과 시 즉시 차단) / 소프트 리밋 (경고 후 허용)
- 월간 자동 리셋 주기 (period ID 기반)
- 80% / 90% / 100% 임계치 알림
- 예산 초과 시 요청 거부 응답 (429 + 예산 상태 정보)

## Data Ownership
- **Owns**: Budget (예산 설정), UsageRecord (사용량 기록)
- **References**: Organization, Team, User (F003)

## Interfaces
- **Provides**: `GET /budgets/:level/:id`, `PUT /budgets/:level/:id`, `GET /usage/:level/:id`, BudgetGuard (NestJS Guard — LLM 요청 전 예산 체크)
- **Consumes**: F001 RedisModule, F003 TenantContext/AuthGuard

## Dependencies
- F001 Foundation Setup
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- **TB-001 Race Condition on Budget Check**: 동시 요청이 동시에 예산 체크 통과 → 둘 다 실행 → 합산 비용이 예산 초과. Redis Lua 또는 PostgreSQL SELECT FOR UPDATE로 원자적 체크-예약.
- **TB-002 Retry Double-Charge**: 요청 실패 후 자동 재시도 시 이중 과금 방지. 멱등성 키로 같은 예약 재사용. 최종 성공만 정산.
- **TB-003 Streaming Token Count Drift**: 청크별 카운팅은 실시간 표시용. 프로바이더의 최종 `usage` 필드를 ground truth로 정산.
- **TB-004 Reset Timing Race**: 리셋 실행 중 인플라이트 요청의 정산이 새 기간에 차감되는 버그 방지. 예약 시점의 period ID 추적.
- **TB-005 Hierarchy Bypass**: User 잔여 있어도 Team 소진이면 차단. User → Team → Org 순서 (bottom-up, 가장 제한적 먼저).

## For /speckit.specify
- SC 필수: 예산 체크 플로우 (사전 추정 → 예산 체크 → 예약 → 실행 → 정산). 각 단계 실패 시 동작 정의.
- SC 필수: 차감 원자성 보장 메커니즘 (Redis Lua script)
- SC 필수: 계층 강제 — User→Team→Org bottom-up 체크, 첫 리밋 히트 시 short-circuit
- SC 필수: 리셋 주기 (월간), 리셋 시간, 이월 정책 (0으로 리셋)
- SC 필수: 알림 임계치 (80/90/100%), 전달 방식 (webhook, in-app), 100%에서 하드 블록
- 비용 계산: 프로바이더별 가격 테이블 (로컬) 기반, input/output 토큰 별도 단가
