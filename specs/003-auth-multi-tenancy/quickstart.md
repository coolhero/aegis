# Quickstart: F003 — Auth & Multi-tenancy

## Prerequisites

- F001 Foundation Setup 완료 (Docker Compose, PostgreSQL, Redis 실행 중)
- F002 LLM Gateway Core 완료

## Setup

```bash
# 1. 새 패키지 설치
npm install @nestjs/jwt @nestjs/passport passport-jwt bcryptjs
npm install -D @types/passport-jwt @types/bcryptjs

# 2. 환경변수 추가 (.env)
JWT_SECRET=your-jwt-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# 3. 서버 시작 (auto-sync로 테이블 자동 생성)
npm run start:dev

# 4. Seed 데이터 확인 (서버 시작 시 자동 실행)
# admin@demo.com / password123 로 로그인 가능
```

## Quick Test

```bash
# JWT 로그인
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}'

# Access Token으로 보호 API 접근
TOKEN="<accessToken from login response>"
curl http://localhost:3000/organizations \
  -H "Authorization: Bearer $TOKEN"

# API Key로 LLM 요청
API_KEY="<key from seed output>"
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'
```

## Key Files

| File | Purpose |
|------|---------|
| `libs/common/src/auth/` | Auth entities, guards, decorators |
| `apps/api/src/auth/` | Auth module, service, controller |
| `apps/api/src/auth/auth.module.ts` | NestJS auth module |
| `apps/api/src/auth/auth.service.ts` | JWT + API Key auth logic |
| `apps/api/src/auth/auth.controller.ts` | Login, refresh endpoints |
