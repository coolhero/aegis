# Quickstart: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25

## Prerequisites

| 도구 | 버전 | 확인 명령 |
|------|---------|---------------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| F001 Foundation | 완료 | `curl localhost:3000/health`가 200을 반환 |

### 필수 API 키

게이트웨이를 테스트하려면 하나 이상의 프로바이더 API 키가 필요하다:

| 변수 | 프로바이더 | 발급처 |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Anthropic | https://console.anthropic.com/settings/keys |

## Setup

### 1. F001 인프라가 실행 중인지 확인

```bash
docker compose up -d
npm run start:dev
```

헬스 확인:

```bash
curl http://localhost:3000/health
```

### 2. 환경에 API 키 추가

`.env` 파일에 추가:

```bash
# 하나 이상 필수
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

`.env` 업데이트 후 애플리케이션을 재시작:

```bash
# Ctrl+C로 중지 후:
npm run start:dev
```

### 3. Provider 및 Model 데이터 시딩

마이그레이션이 기본 프로바이더 및 모델 레코드를 자동으로 시딩한다. 시작 시 애플리케이션 로그에서 시드 확인을 체크하여 검증한다.

## Test: 비스트리밍 요청

### OpenAI Model (gpt-4o)

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Say hello in one sentence."}
    ],
    "max_tokens": 50
  }' | jq .
```

예상 응답:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1711360000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 8,
    "total_tokens": 28
  }
}
```

### Anthropic Model (claude-sonnet-4-20250514)

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Say hello in one sentence."}
    ],
    "max_tokens": 50
  }' | jq .
```

예상 응답 (동일한 OpenAI 호환 형식):

```json
{
  "id": "msg_...",
  "object": "chat.completion",
  "created": 1711360000,
  "model": "claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! It's nice to meet you."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 9,
    "total_tokens": 27
  }
}
```

## Test: 스트리밍 요청 (SSE)

### OpenAI 스트리밍

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Count from 1 to 5."}
    ],
    "max_tokens": 100,
    "stream": true
  }'
```

예상 출력 (SSE 이벤트, 라인별):

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"1"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":","},"finish_reason":null}]}

...

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

```

### Anthropic 스트리밍

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "Count from 1 to 5."}
    ],
    "max_tokens": 100,
    "stream": true
  }'
```

예상 출력: OpenAI와 동일한 SSE 형식 (게이트웨이가 Anthropic 스트리밍 이벤트를 OpenAI 청크 형식으로 변환).

## Test: 에러 처리

### 알 수 없는 모델

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nonexistent-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq .
```

예상 응답 (400):

```json
{
  "error": {
    "message": "Unknown model: nonexistent-model",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

### messages 누락

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o"
  }' | jq .
```

예상 응답 (400):

```json
{
  "error": {
    "message": "messages is required and must be a non-empty array",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "invalid_value"
  }
}
```

### 잘못된 API 키 (프로바이더 에러)

API 키가 잘못되었거나 누락된 경우, 프로바이더가 인증 에러를 반환한다:

```json
{
  "error": {
    "message": "Provider error: Authentication failed",
    "type": "upstream_error",
    "param": null,
    "code": "provider_error"
  }
}
```

## SSE 헤더 확인

```bash
curl -sI -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hi"}],
    "stream": true
  }' 2>&1 | head -10
```

예상 헤더:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## 일반적인 문제

### 유효한 모델명에 대해 "Unknown model" 발생

모델 시드 데이터가 적용되지 않았을 수 있다. `models` 테이블에 항목이 있는지 확인:

```bash
# postgres에 연결
docker compose exec postgres psql -U aegis -d aegis -c "SELECT name, enabled FROM models;"
```

### 프로바이더가 401/403 반환

API 키가 잘못되었거나 설정되지 않았다. `.env`를 확인:

```bash
grep -E "OPENAI_API_KEY|ANTHROPIC_API_KEY" .env
```

### 스트리밍 응답이 멈춤

스트리밍 요청에 `curl -N` (no-buffer)을 사용해야 한다. `-N` 없이는 curl이 전체 응답을 표시 전에 버퍼링한다.

### 포트 3000에서 연결 거부

애플리케이션이 실행 중이지 않다. 시작하기:

```bash
npm run start:dev
```

### TypeORM 엔티티 동기화 에러

엔티티 변경이 반영되지 않으면 개발 서버를 재시작한다. 개발 모드에서 `synchronize: true`가 시작 시 스키마를 자동 동기화한다.
