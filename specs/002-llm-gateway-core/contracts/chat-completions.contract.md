# API Contract: Chat Completions

**Feature**: F002 — LLM Gateway Core
**Base Path**: `/v1`
**Authentication**: 없음 (F003에서 Bearer 토큰 인증 추가 예정)

---

## POST /v1/chat/completions

**Description**: OpenAI 호환 chat completions 엔드포인트. `model` 필드를 기반으로 적절한 LLM 프로바이더(OpenAI, Anthropic)로 요청을 라우팅한다. 비스트리밍(JSON 응답)과 스트리밍(SSE) 모드를 모두 지원한다.

**Authentication**: 불필요 (F003으로 연기)

### Request

#### Headers

| Header | Required | Value | Description |
|--------|----------|-------|-------------|
| `Content-Type` | Yes | `application/json` | 요청 본문 형식 |
| `Accept` | No | `application/json` or `text/event-stream` | 선호하는 응답 형식 |

#### Request Body

```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false,
  "top_p": 1.0
}
```

#### Request Body Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `model` | string | Yes | - | 모델명 (예: `"gpt-4o"`, `"claude-sonnet-4-20250514"`) |
| `messages` | array | Yes | - | 대화 메시지 배열 |
| `messages[].role` | string | Yes | - | `"system"` \| `"user"` \| `"assistant"` |
| `messages[].content` | string | Yes | - | 메시지 내용 텍스트 |
| `temperature` | number | No | `1.0` | 샘플링 온도 (0.0 - 2.0) |
| `max_tokens` | integer | No | `4096` | 생성할 최대 토큰 수 |
| `stream` | boolean | No | `false` | SSE 스트리밍 활성화 |
| `top_p` | number | No | `1.0` | Nucleus 샘플링 파라미터 (0.0 - 1.0) |
| `stop` | string \| string[] | No | `null` | 중지 시퀀스 |

---

### Response 200 — 비스트리밍 (`stream: false`)

전체 생성된 메시지를 포함한 완전한 JSON 응답.

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1711360000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 12,
    "total_tokens": 37
  }
}
```

#### Non-Streaming Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 고유 completion 식별자 |
| `object` | string | 항상 `"chat.completion"` |
| `created` | integer | 생성 시점의 Unix 타임스탬프 |
| `model` | string | completion에 사용된 모델 |
| `choices` | array | completion 선택 배열 |
| `choices[].index` | integer | 선택 인덱스 (단일 completion의 경우 항상 0) |
| `choices[].message.role` | string | 항상 `"assistant"` |
| `choices[].message.content` | string | 생성된 텍스트 |
| `choices[].finish_reason` | string | `"stop"` \| `"length"` \| `"content_filter"` |
| `usage.prompt_tokens` | integer | 입력 토큰 수 |
| `usage.completion_tokens` | integer | 출력 토큰 수 |
| `usage.total_tokens` | integer | 총 토큰 수 |

---

### Response 200 — 스트리밍 (`stream: true`)

Server-Sent Events 스트림. 각 이벤트는 completion의 청크를 포함한다.

#### Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `Transfer-Encoding` | `chunked` |

#### SSE Stream Format

각 청크는 SSE `data` 이벤트로 전송된다:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":25,"completion_tokens":2,"total_tokens":27}}

data: [DONE]

```

#### Streaming Chunk Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 고유 completion 식별자 (모든 청크에 동일) |
| `object` | string | 항상 `"chat.completion.chunk"` |
| `created` | integer | Unix 타임스탬프 |
| `model` | string | 사용된 모델 |
| `choices[].index` | integer | 선택 인덱스 |
| `choices[].delta.role` | string | 첫 번째 청크에서만 존재: `"assistant"` |
| `choices[].delta.content` | string | 토큰 텍스트 (최종 청크에서는 빈 문자열) |
| `choices[].finish_reason` | string \| null | 스트리밍 중 `null`, 최종 청크에서 `"stop"` \| `"length"` |
| `usage` | object | 최종 청크에서만 존재 (`finish_reason`과 함께) |

#### SSE Lifecycle

1. 클라이언트가 `stream: true`로 `POST /v1/chat/completions`를 전송
2. 서버가 `200`과 `Content-Type: text/event-stream`으로 응답
3. 첫 번째 청크: `delta`에 `role: "assistant"` 포함
4. 후속 청크: `delta`에 `content` 토큰 포함
5. 최종 청크: `finish_reason`이 설정되고 `usage`가 포함
6. 스트림이 `data: [DONE]\n\n`으로 종료

---

### Response 400 — Bad Request

잘못된 요청 본문 (필수 필드 누락, 잘못된 모델명 등).

```json
{
  "error": {
    "message": "Unknown model: nonexistent-model. Available models: gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514, claude-haiku-3-5",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

### Response 400 — Validation Error

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

### Response 502 — Provider Error

업스트림 LLM 프로바이더가 에러를 반환했다.

```json
{
  "error": {
    "message": "Provider error: OpenAI API returned 429 Too Many Requests",
    "type": "upstream_error",
    "param": null,
    "code": "provider_error"
  }
}
```

### Response 504 — Provider Timeout

업스트림 LLM 프로바이더가 타임아웃 기간 내에 응답하지 않았다.

```json
{
  "error": {
    "message": "Provider timeout: OpenAI did not respond within 30s",
    "type": "upstream_error",
    "param": null,
    "code": "provider_timeout"
  }
}
```

#### Error Response Schema (OpenAI-Compatible)

| Field | Type | Description |
|-------|------|-------------|
| `error.message` | string | 사람이 읽을 수 있는 에러 설명 |
| `error.type` | string | 에러 카테고리: `"invalid_request_error"` \| `"upstream_error"` \| `"server_error"` |
| `error.param` | string \| null | 에러를 유발한 파라미터 |
| `error.code` | string | 기계가 읽을 수 있는 에러 코드 |

#### SSE Mid-Stream Error

스트리밍이 시작된 후 에러가 발생하면, 종료 전에 에러가 SSE 이벤트로 전송된다:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"error":{"message":"Provider connection lost","type":"upstream_error","code":"provider_error"}}

data: [DONE]

```

---

### Anthropic Format Conversion Reference

`model`이 Anthropic 프로바이더로 해석될 때, 게이트웨이가 다음과 같이 변환한다:

#### Request Conversion (OpenAI -> Anthropic)

| OpenAI Field | Anthropic Field | Notes |
|-------------|----------------|-------|
| `model` | `model` | 그대로 전달 |
| `messages[role=system]` | `system` (top-level) | messages 배열에서 추출 |
| `messages[role=user\|assistant]` | `messages` | 배열에 유지, content가 block으로 래핑 |
| `max_tokens` | `max_tokens` | Anthropic에서 필수 (생략 시 기본값: 4096) |
| `temperature` | `temperature` | 직접 매핑 |
| `top_p` | `top_p` | 직접 매핑 |
| `stream` | `stream` | 직접 매핑 |
| `stop` | `stop_sequences` | 이름만 변경 |

#### Response Conversion (Anthropic -> OpenAI)

| Anthropic Field | OpenAI Field | Notes |
|----------------|-------------|-------|
| `id` | `id` | 그대로 전달 |
| `content[0].text` | `choices[0].message.content` | content block에서 텍스트 추출 |
| `stop_reason: "end_turn"` | `finish_reason: "stop"` | enum 매핑 |
| `stop_reason: "max_tokens"` | `finish_reason: "length"` | enum 매핑 |
| `usage.input_tokens` | `usage.prompt_tokens` | 이름 변경 |
| `usage.output_tokens` | `usage.completion_tokens` | 이름 변경 |
| (computed) | `usage.total_tokens` | prompt + completion의 합계 |
| (set) | `object` | `"chat.completion"` |
| (set) | `created` | Unix 타임스탬프 |

---

### Notes

- 모든 에러 응답은 클라이언트 호환성을 위해 OpenAI의 에러 형식을 따른다.
- 응답의 `model` 필드는 프로바이더의 내부 모델 식별자가 아닌, 클라이언트가 보낸 모델명을 항상 반영한다.
- `max_tokens`는 지정되지 않으면 기본값 4096이다. Anthropic의 경우 항상 전송된다(필수 파라미터).
- 스트리밍 응답의 토큰 `usage`는 최종 청크에서만 포함된다. 실시간 청크별 토큰 카운팅은 내부적으로 처리되지만 SSE 스트림에 노출되지 않는다.
- 인증은 F003에서 추가될 예정이다. 현재 구현은 API 키 검증 없이 모든 요청을 수락한다.
