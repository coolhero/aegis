# Quickstart: F005 — Request Logging & Tracing

## 필수 조건

- F001 Foundation Setup 완료 (PostgreSQL, Redis 실행 중)
- F002 LLM Gateway Core 완료 (Provider/Model 시드 데이터)
- F003 Auth & Multi-tenancy 완료 (Organization, User, ApiKey)
- Node.js 20+, npm

## 셋업

```bash
# 1. 의존성 설치
npm install langfuse-node @opentelemetry/api

# 2. 환경 변수 추가 (.env)
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=http://localhost:3001  # 셀프호스팅 Langfuse

# 3. 마이그레이션 실행
npm run migration:generate -- -n CreateRequestLogs
npm run migration:run

# 4. 서버 시작
npm run start:dev
```

## 빠른 테스트

```bash
# API Key로 LLM 요청 → 로그 자동 생성
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: aegis_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'

# 로그 조회
curl http://localhost:3000/logs \
  -H "Authorization: Bearer <jwt_token>"

# 모델별 일별 사용량
curl "http://localhost:3000/analytics/usage?groupBy=model&period=daily" \
  -H "Authorization: Bearer <jwt_token>"
```

## Langfuse 대시보드

Langfuse 셀프호스팅 인스턴스가 실행 중이면:
1. `http://localhost:3001` 접속
2. Traces 탭에서 LLM 요청 trace 확인
3. 각 trace 하위에 generation span 확인 (model, usage, metadata)
