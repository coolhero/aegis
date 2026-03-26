# Research: F004 — Token Budget Management

## 핵심 결정

### 1. Redis Lua Script vs PostgreSQL FOR UPDATE

**선택**: Redis Lua Script
**이유**: 동시 100개 요청의 원자적 check-and-reserve에서 PostgreSQL row lock은 경합 심화. Redis Lua는 단일 스레드 실행으로 원자성 보장 + 지연시간 < 1ms.
**Trade-off**: Redis 장애 시 fallback 필요 (v2). 현재 MVP는 Redis 의존.

### 2. 토큰 추정 방식

**선택**: Input 메시지 길이 기반 간이 추정 (1 token ≈ 4 chars for English, ≈ 2 chars for Korean)
**이유**: tiktoken 라이브러리 의존 없이 빠른 추정. 정산 시 프로바이더 실제 usage로 보정하므로 추정 오차 허용.
**대안 거부**: tiktoken (정확하지만 느림, 모델별 인코더 필요 — v2에서 옵션)

### 3. 예산 초기화 스케줄러

**선택**: BullMQ Repeatable Job
**이유**: 이미 F001에서 Redis + BullMQ 인프라 구성. cron 패턴으로 월간 실행. 장애 시 재시도 내장.
**대안 거부**: node-cron (프로세스 내 스케줄러 — 멀티 인스턴스에서 중복 실행 위험)

### 4. 계층 검사 순서

**선택**: User → Team → Org (bottom-up, 가장 제한적인 레벨 우선)
**이유**: 하위 레벨에서 먼저 차단하면 불필요한 상위 레벨 검사 방지. 사용자에게 가장 구체적인 차단 이유 제공.

### 5. 알림 전달 방식

**선택**: Webhook POST
**이유**: 알림 소비자(Slack, Email, PagerDuty 등)와 디커플링. 웹훅 하나만 구현하면 소비자는 자유롭게 연동 가능.
