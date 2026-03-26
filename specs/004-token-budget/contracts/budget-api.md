# API Contracts: F004 — Budget REST API

## PUT /budgets/:level/:id

예산 설정/수정. Admin 전용.

**Path Parameters**:
- `level`: `org` | `team` | `user`
- `id`: 대상 엔티티 UUID

**Request**:
```json
{
  "token_limit": 1000000,
  "cost_limit_usd": 100.00,
  "alert_thresholds": [80, 90, 100],
  "webhook_url": "https://example.com/webhook",
  "enabled": true
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "level": "org",
  "target_id": "uuid",
  "token_limit": 1000000,
  "cost_limit_usd": 100.00,
  "alert_thresholds": [80, 90, 100],
  "period_type": "monthly",
  "webhook_url": "https://example.com/webhook",
  "enabled": true,
  "current_period": {
    "id": "uuid",
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-04-01T00:00:00Z",
    "total_tokens_used": 0,
    "total_cost_usd": 0
  }
}
```

**Response 403**: 권한 없음 (RBAC — Admin 이상 필요)
**Response 404**: 대상 엔티티 미존재

---

## GET /budgets/:level/:id

예산 조회.

**Response 200**: PUT과 동일한 구조

---

## GET /usage/:level/:id

사용량 조회 (현재 기간).

**Query Parameters**:
- `period` (optional): `YYYY-MM` 형식. 미지정 시 현재 기간

**Response 200**:
```json
{
  "budget_id": "uuid",
  "level": "org",
  "target_id": "uuid",
  "period": {
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-04-01T00:00:00Z"
  },
  "token_limit": 1000000,
  "tokens_used": 450000,
  "tokens_remaining": 550000,
  "token_usage_pct": 45.0,
  "cost_limit_usd": 100.00,
  "cost_used_usd": 45.00,
  "cost_remaining_usd": 55.00,
  "cost_usage_pct": 45.0
}
```

---

## GET /usage/summary

조직 전체 사용량 요약 (Admin 전용).

**Query Parameters**:
- `period` (optional): `YYYY-MM` 형식

**Response 200**:
```json
{
  "org": {
    "token_limit": 1000000,
    "tokens_used": 450000,
    "token_usage_pct": 45.0,
    "cost_limit_usd": 100.00,
    "cost_used_usd": 45.00
  },
  "teams": [
    {
      "team_id": "uuid",
      "team_name": "Backend Team",
      "token_limit": 600000,
      "tokens_used": 300000,
      "token_usage_pct": 50.0,
      "cost_used_usd": 30.00
    }
  ],
  "users": [
    {
      "user_id": "uuid",
      "user_name": "Admin User",
      "token_limit": 200000,
      "tokens_used": 100000,
      "token_usage_pct": 50.0,
      "cost_used_usd": 10.00
    }
  ]
}
```

---

## Error Responses (공통)

```json
{
  "statusCode": 429,
  "error": "budget_exceeded",
  "message": "Token budget exceeded at team level",
  "details": {
    "level": "team",
    "remaining_tokens": 500,
    "remaining_cost_usd": 0.50,
    "limit_tokens": 600000,
    "limit_cost_usd": 60.00
  }
}
```
