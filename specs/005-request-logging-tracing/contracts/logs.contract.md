# API Contract: Logs & Analytics

**Feature**: F005 — Request Logging & Tracing
**Base Path**: `/logs`, `/analytics`

---

## GET /logs

로그 목록 조회 (필터 + 페이지네이션). AuthGuard + TenantContext 적용.

**Request**:
```
GET /logs?page=1&limit=20&model=gpt-4o&status=success&userId=<uuid>&teamId=<uuid>&startDate=2026-03-01&endDate=2026-03-31&minCost=0.01&maxCost=1.00
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | 페이지 번호 (1-based) |
| `limit` | integer | No | 20 | 페이지 크기 (max: 100) |
| `model` | string | No | — | 모델명 필터 |
| `provider` | string | No | — | 프로바이더명 필터 |
| `userId` | UUID | No | — | 사용자 ID 필터 |
| `teamId` | UUID | No | — | 팀 ID 필터 |
| `status` | string | No | — | 상태 필터: `success` / `error` |
| `startDate` | ISO 8601 | No | — | 시작일 필터 |
| `endDate` | ISO 8601 | No | — | 종료일 필터 |
| `minCost` | number | No | — | 최소 비용 필터 |
| `maxCost` | number | No | — | 최대 비용 필터 |

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "trace_id": "abc123",
      "model": "gpt-4o",
      "provider": "openai",
      "input_tokens": 150,
      "output_tokens": 50,
      "cost_usd": 0.000875,
      "latency_ms": 1200,
      "status": "success",
      "cache_hit": false,
      "created_at": "2026-03-26T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Notes**:
- `org_id` 필터는 자동 적용 (TenantContext에서 추출, 쿼리 파라미터로 노출 안 함)
- `data` 배열의 각 항목에 `input_masked`/`output_masked`는 포함하지 않음 (목록 성능)
- 최신순(`created_at DESC`) 고정 정렬

---

## GET /logs/:id

단건 로그 상세 조회. AuthGuard + TenantContext 적용.

**Request**:
```
GET /logs/550e8400-e29b-41d4-a716-446655440000
```

**Response (200)**:
```json
{
  "id": "uuid",
  "request_id": "uuid",
  "trace_id": "abc123",
  "org_id": "uuid",
  "user_id": "uuid",
  "team_id": "uuid",
  "model": "gpt-4o",
  "provider": "openai",
  "input_masked": "Hello, how are you?",
  "output_masked": "I'm doing well, thank you!",
  "input_tokens": 150,
  "output_tokens": 50,
  "cost_usd": 0.000875,
  "latency_ms": 1200,
  "status": "success",
  "error_detail": null,
  "cache_hit": false,
  "estimated": false,
  "langfuse_trace_id": "lf-trace-abc123",
  "input_size": 19,
  "output_size": 27,
  "created_at": "2026-03-26T10:00:00Z"
}
```

**Response (404)**:
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Log not found"
}
```

**Notes**: 다른 Organization의 로그 ID로 접근 시에도 404 반환 (테넌트 격리)

---

## GET /analytics/usage

사용량 집계. AuthGuard + TenantContext 적용.

**Request**:
```
GET /analytics/usage?groupBy=model&period=daily&startDate=2026-03-01&endDate=2026-03-07
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `groupBy` | string | Yes | — | 집계 축: `model` / `team` / `user` |
| `period` | string | Yes | — | 기간 단위: `daily` / `weekly` / `monthly` |
| `startDate` | ISO 8601 | No | 30일 전 | 시작일 |
| `endDate` | ISO 8601 | No | 오늘 | 종료일 |

**Response (200)**:
```json
{
  "data": [
    {
      "group": "gpt-4o",
      "period": "2026-03-01",
      "request_count": 45,
      "total_input_tokens": 15000,
      "total_output_tokens": 5000,
      "total_tokens": 20000
    }
  ],
  "meta": {
    "groupBy": "model",
    "period": "daily",
    "startDate": "2026-03-01",
    "endDate": "2026-03-07"
  }
}
```

---

## GET /analytics/cost

비용 집계. AuthGuard + TenantContext 적용.

**Request**:
```
GET /analytics/cost?groupBy=team&period=monthly&startDate=2026-01-01&endDate=2026-03-31
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `groupBy` | string | Yes | — | 집계 축: `model` / `team` / `user` |
| `period` | string | Yes | — | 기간 단위: `daily` / `weekly` / `monthly` |
| `startDate` | ISO 8601 | No | 30일 전 | 시작일 |
| `endDate` | ISO 8601 | No | 오늘 | 종료일 |

**Response (200)**:
```json
{
  "data": [
    {
      "group": "engineering",
      "period": "2026-03",
      "total_cost_usd": 125.50,
      "request_count": 3200
    }
  ],
  "meta": {
    "groupBy": "team",
    "period": "monthly",
    "startDate": "2026-01-01",
    "endDate": "2026-03-31"
  }
}
```
