# API Contracts: F012 — Developer Playground

## 신규 API 없음 (프론트엔드 전용)

F012는 기존 API를 소비만 합니다. 신규 백엔드 API 엔드포인트를 생성하지 않습니다.

## 소비하는 API

### F002 — LLM Gateway

| Method | Path | 용도 |
|--------|------|------|
| POST | `/v1/chat/completions` | LLM 호출 (stream=true for SSE) |

**요청 예시**:
```json
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": true
}
```

### F003 — Auth

| Method | Path | 용도 |
|--------|------|------|
| POST | `/auth/login` | JWT 로그인 |
| POST | `/auth/refresh` | JWT 갱신 |

### F010 — Prompt Management

| Method | Path | 용도 |
|--------|------|------|
| GET | `/prompts` | 프롬프트 템플릿 목록 |
| GET | `/prompts/:id` | 프롬프트 상세 |
| GET | `/prompts/:id/versions` | 버전 목록 |
| POST | `/prompts/:id/resolve` | 변수 치환 (렌더링) |

### 모델 목록 (내부)

모델 목록은 현재 별도 API가 없으므로, F002의 Provider/Model을 직접 조회하거나, 프론트엔드에서 정적 목록을 사용합니다.

> **MVP 접근**: 모델 목록은 프론트엔드 설정 파일에 하드코딩. 향후 `/models` API 추가 시 동적 전환.

## UI 라우트

| Path | Component | Description |
|------|-----------|-------------|
| `/playground` | `page.tsx` | Playground 메인 (모델 테스트 + 비용 추정 + 히스토리) |
| `/playground/api-explorer` | `api-explorer/page.tsx` | API 탐색기 |
