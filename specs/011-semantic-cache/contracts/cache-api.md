# API Contracts: F011 — Semantic Cache

## GET /cache/stats

**Auth**: JWT (any role)
**Query**: `?period=24h|7d|30d` (optional, default: all-time)

**Response 200**:
```json
{
  "hit_count": 150,
  "miss_count": 50,
  "hit_rate": 0.75,
  "total_tokens_saved": 125000,
  "total_entries": 200,
  "period": "24h"
}
```

## DELETE /cache

**Auth**: JWT (admin, member)
**Description**: 해당 org의 모든 캐시 삭제

**Response 200**:
```json
{
  "message": "Cache invalidated",
  "deleted_count": 150
}
```

## PUT /cache/policy/:orgId

**Auth**: JWT (admin only)

**Request Body**:
```json
{
  "similarity_threshold": 0.90,
  "ttl_seconds": 3600,
  "enabled": true
}
```

**Response 200**:
```json
{
  "org_id": "org-1",
  "similarity_threshold": 0.90,
  "ttl_seconds": 3600,
  "enabled": true,
  "updated_at": "2026-03-27T..."
}
```

**Response 404**: 타 org의 정책 수정 시도

## GET /cache/policy/:orgId

**Auth**: JWT (admin, member)

**Response 200**:
```json
{
  "org_id": "org-1",
  "similarity_threshold": 0.95,
  "ttl_seconds": 86400,
  "enabled": true
}
```

**Response 404**: 정책 미설정 시 (기본값 반환 대신)

## Internal: CacheInterceptor

**Type**: NestJS Interceptor
**적용 대상**: `POST /v1/chat/completions` (F002)

**동작**:
- 요청 전: 캐시 조회 → 히트 시 응답 반환 + `X-Cache: HIT`
- 요청 후: LLM 응답 캐시 저장 + `X-Cache: MISS`

**헤더**:
- `X-Cache: HIT` — 캐시 히트
- `X-Cache: MISS` — 캐시 미스, LLM 호출
