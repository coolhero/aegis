# API Contract: Organizations & Teams & Users

**Feature**: F003 — Auth & Multi-tenancy
**Base Path**: `/`
**Authentication**: Bearer Token (JWT), 변경(mutation) 작업에 admin 역할 필요

---

## GET /organizations

**Description**: 현재 사용자 소속 조직 조회. admin은 모든 조직, member/viewer는 자신의 조직만.

### Response — 200 OK

```json
[
  {
    "id": "uuid",
    "name": "Demo Organization",
    "slug": "demo-org",
    "plan": "pro",
    "createdAt": "2025-03-25T00:00:00Z"
  }
]
```

---

## GET /organizations/:id

**Description**: 조직 상세 조회.

### Response — 200 OK

```json
{
  "id": "uuid",
  "name": "Demo Organization",
  "slug": "demo-org",
  "plan": "pro",
  "settings": {},
  "createdAt": "2025-03-25T00:00:00Z",
  "updatedAt": "2025-03-25T00:00:00Z"
}
```

### Response — 403 Forbidden

다른 Organization의 데이터 접근 시.

---

## POST /organizations

**Description**: 새 조직 생성. super-admin 전용 (MVP에서는 seed로 생성).

### Request

```json
{
  "name": "New Corp",
  "slug": "new-corp",
  "plan": "pro"
}
```

### Response — 201 Created

---

## GET /teams

**Description**: 현재 사용자 소속 조직의 팀 목록.

**Query**: `?orgId=uuid` (선택, admin 전용)

### Response — 200 OK

```json
[
  {
    "id": "uuid",
    "name": "Backend Team",
    "slug": "backend",
    "orgId": "uuid",
    "createdAt": "2025-03-25T00:00:00Z"
  }
]
```

---

## POST /teams

**Description**: 새 팀 생성. admin 역할 필요.

### Request

```json
{
  "name": "ML Team",
  "slug": "ml-team",
  "orgId": "uuid"
}
```

### Response — 201 Created

---

## GET /users

**Description**: 현재 사용자 소속 조직의 사용자 목록.

**Query**: `?teamId=uuid` (선택 필터)

### Response — 200 OK

```json
[
  {
    "id": "uuid",
    "email": "admin@demo.com",
    "name": "Admin User",
    "role": "admin",
    "orgId": "uuid",
    "teamId": "uuid",
    "createdAt": "2025-03-25T00:00:00Z"
  }
]
```

---

## POST /users

**Description**: 새 사용자 생성. admin 역할 필요.

### Request

```json
{
  "email": "new@demo.com",
  "name": "New User",
  "password": "securepassword",
  "role": "member",
  "teamId": "uuid"
}
```

### Response — 201 Created

비밀번호는 bcrypt 해싱 후 저장. 응답에 password 미포함.
