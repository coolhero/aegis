# API Contract: Authentication

**Feature**: F003 — Auth & Multi-tenancy
**Base Path**: `/auth`

---

## POST /auth/login

**Description**: 이메일/비밀번호 기반 JWT 로그인. Access Token과 Refresh Token을 발급한다.

### Request

```json
{
  "email": "admin@demo.com",
  "password": "password123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | 이메일 주소 |
| `password` | string | Yes | 비밀번호 |

### Response — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@demo.com",
    "name": "Admin User",
    "role": "admin",
    "orgId": "uuid",
    "teamId": "uuid"
  }
}
```

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### JWT Access Token Claims

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string (UUID) | User ID |
| `email` | string | 이메일 |
| `role` | string | 역할 (admin/member/viewer) |
| `orgId` | string (UUID) | Organization ID |
| `teamId` | string (UUID) | Team ID (nullable) |
| `iat` | number | 발급 시간 |
| `exp` | number | 만료 시간 (15분) |

---

## POST /auth/refresh

**Description**: Refresh Token으로 새 토큰 쌍을 발급한다. 사용된 Refresh Token은 즉시 무효화 (Rotation).

### Request

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Response — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Invalid refresh token",
  "error": "Unauthorized"
}
```

---

## POST /auth/profile

**Description**: 현재 로그인한 사용자의 프로필 조회.

**Authentication**: Bearer Token (JWT)

### Response — 200 OK

```json
{
  "id": "uuid",
  "email": "admin@demo.com",
  "name": "Admin User",
  "role": "admin",
  "orgId": "uuid",
  "teamId": "uuid"
}
```
