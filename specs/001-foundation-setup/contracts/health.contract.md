# API Contract: Health Check

**Feature**: F001 — Foundation Setup
**Base Path**: `/`
**Authentication**: 인증 불필요

---

## GET /health

**Description**: 애플리케이션 헬스 체크 엔드포인트. 애플리케이션과 의존하는 인프라 구성요소(데이터베이스, Redis)의 상태를 반환한다. 로드 밸런서, 모니터링 시스템, CI/CD 파이프라인에서 사용된다.

**Authentication**: 인증 불필요

### Request

요청 본문이나 쿼리 파라미터가 없다.

```
GET /health HTTP/1.1
Host: localhost:3000
```

### Response 200 — Healthy

모든 구성요소가 정상 작동 중이다.

```json
{
  "status": "ok",
  "components": {
    "db": "up",
    "redis": "up"
  },
  "timestamp": "2025-03-25T09:00:00.000Z"
}
```

### Response 200 — Degraded

비핵심 구성요소(Redis)가 다운되었지만, 애플리케이션은 기능을 유지한다.

```json
{
  "status": "degraded",
  "components": {
    "db": "up",
    "redis": "down"
  },
  "timestamp": "2025-03-25T09:00:00.000Z"
}
```

### Response 503 — Unhealthy

핵심 구성요소(데이터베이스)가 다운되었다. 애플리케이션이 안정적으로 요청을 처리할 수 없다.

```json
{
  "status": "error",
  "components": {
    "db": "down",
    "redis": "up"
  },
  "timestamp": "2025-03-25T09:00:00.000Z"
}
```

### Response Schema

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `status` | string | `"ok"` \| `"degraded"` \| `"error"` | 전체 애플리케이션 헬스 상태 |
| `components.db` | string | `"up"` \| `"down"` | PostgreSQL 연결 상태 |
| `components.redis` | string | `"up"` \| `"down"` | Redis 연결 상태 |
| `timestamp` | string | ISO 8601 | 응답 시점의 서버 타임스탬프 |

### Status Code Logic

| DB Status | Redis Status | HTTP Code | `status` field |
|-----------|-------------|-----------|----------------|
| up | up | 200 | `"ok"` |
| up | down | 200 | `"degraded"` |
| down | up | 503 | `"error"` |
| down | down | 503 | `"error"` |

### Notes

- 이 엔드포인트는 외부 헬스 모니터링을 허용하기 위해 인증을 요구하지 않는다(NOT).
- Redis는 비핵심으로 취급된다: 장애 시 애플리케이션을 저하시키지만 비정상 상태로 만들지는 않는다.
- 데이터베이스는 핵심으로 취급된다: 장애 시 503과 `"error"` 상태를 반환한다.
- `timestamp` 필드는 응답 시점의 서버 UTC 시간을 사용한다.
