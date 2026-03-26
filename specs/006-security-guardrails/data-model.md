# Data Model: Security Guardrails

**Feature**: F006 - Security Guardrails
**Date**: 2026-03-26

## Entities

### SecurityPolicy

테넌트(Organization)별 보안 정책 설정.

```
SecurityPolicy {
  id              UUID        PK, auto-generated
  org_id          UUID        FK → Organization(id), UNIQUE
  pii_categories  JSONB       탐지 대상 PII 유형 배열
                              예: ["email", "phone", "ssn", "name", "address"]
                              기본값: ["email", "phone", "ssn"]
  pii_action      VARCHAR(10) ENUM: "mask" | "reject" | "warn"
                              기본값: "mask"
  injection_defense_enabled  BOOLEAN  기본값: true
  content_filter_categories  JSONB    필터링 카테고리 배열
                              예: ["hate_speech", "violence", "self_harm", "illegal"]
                              기본값: ["hate_speech", "violence", "self_harm", "illegal"]
  bypass_roles    JSONB       바이패스 허용 역할 배열
                              예: ["admin"]
                              기본값: []
  custom_pii_patterns  JSONB  커스텀 정규식 패턴 배열
                              예: [{"name": "employee_id", "pattern": "EMP-\\d{4}", "placeholder": "[EMPLOYEE_ID]"}]
                              기본값: []
  created_at      TIMESTAMP   auto-generated
  updated_at      TIMESTAMP   auto-updated
}

Indexes:
  - UNIQUE INDEX ON (org_id)

Relationships:
  - SecurityPolicy.org_id → Organization.id (MANY-TO-ONE)
```

### GuardResult

개별 가드레일 스캐너의 판정 결과 기록.

```
GuardResult {
  id              UUID        PK, auto-generated
  request_id      VARCHAR     요청 식별자 (GatewayRequest의 id 또는 trace_id)
  scanner_type    VARCHAR(20) ENUM: "pii" | "injection" | "content"
  decision        VARCHAR(10) ENUM: "pass" | "block" | "mask" | "bypass"
  details         JSONB       판정 상세
                              pii: { detected: ["email"], masked_count: 1, original_length: 120 }
                              injection: { pattern: "ignore previous", confidence: 0.95 }
                              content: { category: "hate_speech", severity: "high" }
                              bypass: { user_id: "...", role: "admin", reason: "..." }
  latency_ms      INTEGER     스캐너 처리 시간 (밀리초)
  created_at      TIMESTAMP   auto-generated
}

Indexes:
  - INDEX ON (request_id)
  - INDEX ON (scanner_type, decision)
  - INDEX ON (created_at)

Relationships:
  - GuardResult.request_id → GatewayRequest.id (논리적 참조, 외래키 미설정 — 비동기 로깅)
```

## Default Security Policy

신규 조직 또는 정책 미설정 조직에 적용되는 기본 정책:

```json
{
  "pii_categories": ["email", "phone", "ssn"],
  "pii_action": "mask",
  "injection_defense_enabled": true,
  "content_filter_categories": ["hate_speech", "violence", "self_harm", "illegal"],
  "bypass_roles": [],
  "custom_pii_patterns": []
}
```

## Entity Relationship Diagram

```
Organization (F003)
    │
    └──── SecurityPolicy (F006) [1:1 per org]
              │
              └──── applied to ──── GatewayRequest (F002)
                                        │
                                        └──── GuardResult (F006) [1:N per request]
                                                    │
                                                    └──── referenced by ──── RequestLog (F005)
```
