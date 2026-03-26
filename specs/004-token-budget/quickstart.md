# Quickstart: F004 — Token Budget Management

## Prerequisites

- F001 Foundation (Docker Compose: PostgreSQL + Redis)
- F002 LLM Gateway Core (Provider + Model 엔티티)
- F003 Auth & Multi-tenancy (Org/Team/User + RBAC)

## Setup

```bash
# 1. 인프라 시작
docker compose up -d

# 2. 마이그레이션 실행
npm run migration:run

# 3. 시드 데이터
npm run seed

# 4. 서버 시작
npm run start:dev
```

## Quick Test

```bash
# 1. 로그인 (admin)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.access_token')

# 2. Org 예산 설정
curl -X PUT http://localhost:3000/budgets/org/<org-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_limit":1000000,"cost_limit_usd":100}'

# 3. 예산 조회
curl http://localhost:3000/budgets/org/<org-id> \
  -H "Authorization: Bearer $TOKEN"

# 4. LLM 요청 (예산 차감 확인)
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer aegis_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'

# 5. 사용량 확인
curl http://localhost:3000/usage/org/<org-id> \
  -H "Authorization: Bearer $TOKEN"
```
