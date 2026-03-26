# API Contract: Security Policies

**Feature**: F006 - Security Guardrails
**Base Path**: `/security-policies`

---

## GET /security-policies/:orgId

조직의 보안 정책 조회.

**Authentication**: Required (API Key or JWT)
**Authorization**: 해당 조직 소속 인증된 사용자 (모든 역할)

### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| orgId | path | UUID | Yes | 조직 ID |

### Response 200

```json
{
  "id": "uuid",
  "org_id": "uuid",
  "pii_categories": ["email", "phone", "ssn"],
  "pii_action": "mask",
  "injection_defense_enabled": true,
  "content_filter_categories": ["hate_speech", "violence", "self_harm", "illegal"],
  "bypass_roles": ["admin"],
  "custom_pii_patterns": [
    {
      "name": "employee_id",
      "pattern": "EMP-\\d{4}",
      "placeholder": "[EMPLOYEE_ID]"
    }
  ],
  "updated_at": "2026-03-26T10:00:00Z"
}
```

### Response 404

정책 미설정 조직 → 기본 정책 반환 (DB 미저장 상태에서도 기본값 제공)

```json
{
  "id": null,
  "org_id": "uuid",
  "pii_categories": ["email", "phone", "ssn"],
  "pii_action": "mask",
  "injection_defense_enabled": true,
  "content_filter_categories": ["hate_speech", "violence", "self_harm", "illegal"],
  "bypass_roles": [],
  "custom_pii_patterns": []
}
```

### Response 401
인증 실패.

### Response 403
다른 조직의 정책 조회 시도.

---

## PUT /security-policies/:orgId

조직의 보안 정책 수정 (생성 또는 업데이트).

**Authentication**: Required (API Key or JWT)
**Authorization**: Org Admin only (role: admin)

### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| orgId | path | UUID | Yes | 조직 ID |

### Request Body

```json
{
  "pii_categories": ["email", "phone", "ssn", "name"],
  "pii_action": "mask",
  "injection_defense_enabled": true,
  "content_filter_categories": ["hate_speech", "violence"],
  "bypass_roles": ["admin"],
  "custom_pii_patterns": [
    {
      "name": "employee_id",
      "pattern": "EMP-\\d{4}",
      "placeholder": "[EMPLOYEE_ID]"
    }
  ]
}
```

**Validation**:
- pii_categories: 배열, 각 항목은 알려진 PII 유형 또는 custom_pii_patterns의 name
- pii_action: "mask" | "reject" | "warn"
- content_filter_categories: 배열, 각 항목은 알려진 카테고리
- bypass_roles: 배열, 각 항목은 유효한 역할명
- custom_pii_patterns: 배열, 각 항목에 name(string), pattern(valid regex), placeholder(string) 필수

### Response 200

```json
{
  "id": "uuid",
  "org_id": "uuid",
  "pii_categories": ["email", "phone", "ssn", "name"],
  "pii_action": "mask",
  "injection_defense_enabled": true,
  "content_filter_categories": ["hate_speech", "violence"],
  "bypass_roles": ["admin"],
  "custom_pii_patterns": [...],
  "updated_at": "2026-03-26T10:05:00Z"
}
```

### Response 400
유효하지 않은 요청 (잘못된 pii_action, 유효하지 않은 regex 등).

### Response 401
인증 실패.

### Response 403
Admin이 아닌 역할의 수정 시도.
