# Quickstart: F010 — Prompt Management

## 전제 조건

- F001 (Foundation) 완료 — PostgreSQL, Redis 실행 중
- F003 (Auth) 완료 — JWT 인증, API Key 인증 가능

## 빠른 시작

```bash
# 1. 서버 시작
npm run start:dev

# 2. 로그인
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@aegis.local","password":"admin123"}' | jq -r .access_token)

# 3. 프롬프트 생성
curl -X POST http://localhost:3000/prompts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Customer Support",
    "description": "고객 지원 프롬프트",
    "content": "{{role}}님, {{topic}}에 대해 {{lang|한국어}}로 답변해주세요."
  }'

# 4. 버전 배포
curl -X POST http://localhost:3000/prompts/{id}/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version": 1}'

# 5. 프롬프트 해결 (변수 치환)
curl -X POST http://localhost:3000/prompts/{id}/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"variables": {"role": "전문가", "topic": "AI 보안"}}'
# → "전문가님, AI 보안에 대해 한국어로 답변해주세요."
```

## 핵심 API

| Method | Path | Description |
|--------|------|-------------|
| POST | /prompts | 프롬프트 생성 |
| PUT | /prompts/:id | 프롬프트 수정 (새 버전 생성) |
| POST | /prompts/:id/publish | 버전 배포 |
| POST | /prompts/:id/rollback | 버전 롤백 |
| POST | /prompts/:id/ab-test | A/B 테스트 설정 |
| POST | /prompts/:id/resolve | 프롬프트 해결 (변수 치환) |
