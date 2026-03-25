# API Contract: Health Check

**Feature**: F001 — Foundation Setup
**Base Path**: `/`
**Authentication**: None required

---

## GET /health

**Description**: Application health check endpoint. Returns the status of the application and its dependent infrastructure components (database, Redis). Used by load balancers, monitoring systems, and CI/CD pipelines.

**Authentication**: None required

### Request

No request body or query parameters.

```
GET /health HTTP/1.1
Host: localhost:3000
```

### Response 200 — Healthy

All components are operational.

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

Non-critical component (Redis) is down, but the application remains functional.

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

Critical component (database) is down. The application cannot serve requests reliably.

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
| `status` | string | `"ok"` \| `"degraded"` \| `"error"` | Overall application health status |
| `components.db` | string | `"up"` \| `"down"` | PostgreSQL connection status |
| `components.redis` | string | `"up"` \| `"down"` | Redis connection status |
| `timestamp` | string | ISO 8601 | Server timestamp at response time |

### Status Code Logic

| DB Status | Redis Status | HTTP Code | `status` field |
|-----------|-------------|-----------|----------------|
| up | up | 200 | `"ok"` |
| up | down | 200 | `"degraded"` |
| down | up | 503 | `"error"` |
| down | down | 503 | `"error"` |

### Notes

- The endpoint does NOT require authentication to allow external health monitoring.
- Redis is treated as non-critical: its failure degrades the application but does not make it unhealthy.
- Database is treated as critical: its failure results in 503 and `"error"` status.
- The `timestamp` field uses the server's UTC time at the moment of the response.
