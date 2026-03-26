# API Contract: Provider Health

**Feature**: F008 — Provider Fallback & Load Balancing
**Base Path**: `/providers`

---

## GET /providers/health

프로바이더별 헬스 상태, 서킷 브레이커 상태, 평균 레이턴시, 에러율 조회. JwtAuthGuard 적용.

### Response — 200 OK

```json
[
  {
    "id": "uuid",
    "name": "openai",
    "type": "openai",
    "enabled": true,
    "circuit_state": "CLOSED",
    "failure_count": 0,
    "avg_latency_ms": 450,
    "error_rate": 0.02,
    "last_check_at": "2026-03-27T10:00:00Z",
    "weight": 1
  },
  {
    "id": "uuid",
    "name": "anthropic",
    "type": "anthropic",
    "enabled": true,
    "circuit_state": "OPEN",
    "failure_count": 5,
    "avg_latency_ms": 0,
    "error_rate": 1.0,
    "last_check_at": "2026-03-27T09:58:00Z",
    "weight": 1
  }
]
```

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
