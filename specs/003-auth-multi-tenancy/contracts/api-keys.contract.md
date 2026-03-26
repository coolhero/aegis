# API Contract: API Keys

**Feature**: F003 — Auth & Multi-tenancy
**Base Path**: `/api-keys`
**Authentication**: Bearer Token (JWT), admin 역할 필요

---

## POST /api-keys

**Description**: 새 API Key 생성. 원본 key는 이 응답에서만 1회 반환.

### Request

```json
{
  "name": "Production Key",
  "scopes": ["gpt-4o", "gpt-4o-mini"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Key 표시명 |
| `scopes` | string[] | No | 허용 모델 목록 (빈 배열 = 전체 모델) |
| `expiresAt` | string (ISO 8601) | No | 만료일 (null = 무기한) |

### Response — 201 Created

```json
{
  "id": "uuid",
  "key": "aegis_a1b2c3d4e5f6...",
  "name": "Production Key",
  "keyPrefix": "aegis_a1b2c3",
  "scopes": ["gpt-4o", "gpt-4o-mini"],
  "expiresAt": "2025-12-31T23:59:59Z",
  "createdAt": "2025-03-25T00:00:00Z"
}
```

> **중요**: `key` 필드는 이 응답에서만 반환됩니다. 이후 조회 불가.

---

## GET /api-keys

**Description**: 현재 조직의 API Key 목록. 원본 key는 미포함, prefix만 표시.

### Response — 200 OK

```json
[
  {
    "id": "uuid",
    "name": "Production Key",
    "keyPrefix": "aegis_a1b2c3",
    "scopes": ["gpt-4o", "gpt-4o-mini"],
    "lastUsedAt": "2025-03-25T10:30:00Z",
    "expiresAt": "2025-12-31T23:59:59Z",
    "revoked": false,
    "createdAt": "2025-03-25T00:00:00Z"
  }
]
```

---

## DELETE /api-keys/:id

**Description**: API Key 폐기(revoke). 물리 삭제가 아닌 `revoked: true` 설정.

### Response — 200 OK

```json
{
  "id": "uuid",
  "revoked": true,
  "message": "API key has been revoked"
}
```

### Response — 404 Not Found

```json
{
  "statusCode": 404,
  "message": "API key not found",
  "error": "Not Found"
}
```
