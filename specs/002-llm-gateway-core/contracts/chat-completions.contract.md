# API Contract: Chat Completions

**Feature**: F002 — LLM Gateway Core
**Base Path**: `/v1`
**Authentication**: None (F003 will add Bearer token authentication)

---

## POST /v1/chat/completions

**Description**: OpenAI-compatible chat completions endpoint. Routes requests to the appropriate LLM provider (OpenAI, Anthropic) based on the `model` field. Supports both non-streaming (JSON response) and streaming (SSE) modes.

**Authentication**: None required (deferred to F003)

### Request

#### Headers

| Header | Required | Value | Description |
|--------|----------|-------|-------------|
| `Content-Type` | Yes | `application/json` | Request body format |
| `Accept` | No | `application/json` or `text/event-stream` | Preferred response format |

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
| `model` | string | Yes | - | Model name (e.g., `"gpt-4o"`, `"claude-sonnet-4-20250514"`) |
| `messages` | array | Yes | - | Conversation messages array |
| `messages[].role` | string | Yes | - | `"system"` \| `"user"` \| `"assistant"` |
| `messages[].content` | string | Yes | - | Message content text |
| `temperature` | number | No | `1.0` | Sampling temperature (0.0 - 2.0) |
| `max_tokens` | integer | No | `4096` | Maximum tokens to generate |
| `stream` | boolean | No | `false` | Enable SSE streaming |
| `top_p` | number | No | `1.0` | Nucleus sampling parameter (0.0 - 1.0) |
| `stop` | string \| string[] | No | `null` | Stop sequences |

---

### Response 200 — Non-Streaming (`stream: false`)

Complete JSON response with the full generated message.

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
| `id` | string | Unique completion identifier |
| `object` | string | Always `"chat.completion"` |
| `created` | integer | Unix timestamp of creation |
| `model` | string | Model used for completion |
| `choices` | array | Array of completion choices |
| `choices[].index` | integer | Choice index (always 0 for single completion) |
| `choices[].message.role` | string | Always `"assistant"` |
| `choices[].message.content` | string | Generated text |
| `choices[].finish_reason` | string | `"stop"` \| `"length"` \| `"content_filter"` |
| `usage.prompt_tokens` | integer | Input token count |
| `usage.completion_tokens` | integer | Output token count |
| `usage.total_tokens` | integer | Total token count |

---

### Response 200 — Streaming (`stream: true`)

Server-Sent Events stream. Each event contains a chunk of the completion.

#### Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `Transfer-Encoding` | `chunked` |

#### SSE Stream Format

Each chunk is sent as an SSE `data` event:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":25,"completion_tokens":2,"total_tokens":27}}

data: [DONE]

```

#### Streaming Chunk Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique completion identifier (same for all chunks) |
| `object` | string | Always `"chat.completion.chunk"` |
| `created` | integer | Unix timestamp |
| `model` | string | Model used |
| `choices[].index` | integer | Choice index |
| `choices[].delta.role` | string | Present only in first chunk: `"assistant"` |
| `choices[].delta.content` | string | Token text (empty string on final chunk) |
| `choices[].finish_reason` | string \| null | `null` during streaming, `"stop"` \| `"length"` on final chunk |
| `usage` | object | Present only in the final chunk (with `finish_reason`) |

#### SSE Lifecycle

1. Client sends `POST /v1/chat/completions` with `stream: true`
2. Server responds with `200` and `Content-Type: text/event-stream`
3. First chunk: `delta` contains `role: "assistant"`
4. Subsequent chunks: `delta` contains `content` tokens
5. Final chunk: `finish_reason` is set, `usage` is included
6. Stream terminates with `data: [DONE]\n\n`

---

### Response 400 — Bad Request

Invalid request body (missing required fields, invalid model name, etc.).

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

The upstream LLM provider returned an error.

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

The upstream LLM provider did not respond within the timeout period.

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
| `error.message` | string | Human-readable error description |
| `error.type` | string | Error category: `"invalid_request_error"` \| `"upstream_error"` \| `"server_error"` |
| `error.param` | string \| null | The parameter that caused the error |
| `error.code` | string | Machine-readable error code |

#### SSE Mid-Stream Error

When an error occurs after streaming has begun, the error is sent as an SSE event before termination:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"error":{"message":"Provider connection lost","type":"upstream_error","code":"provider_error"}}

data: [DONE]

```

---

### Anthropic Format Conversion Reference

When `model` resolves to an Anthropic provider, the gateway converts:

#### Request Conversion (OpenAI -> Anthropic)

| OpenAI Field | Anthropic Field | Notes |
|-------------|----------------|-------|
| `model` | `model` | Pass-through |
| `messages[role=system]` | `system` (top-level) | Extracted from messages array |
| `messages[role=user\|assistant]` | `messages` | Kept in array, content wrapped in blocks |
| `max_tokens` | `max_tokens` | Required in Anthropic (default: 4096 if omitted) |
| `temperature` | `temperature` | Direct mapping |
| `top_p` | `top_p` | Direct mapping |
| `stream` | `stream` | Direct mapping |
| `stop` | `stop_sequences` | Rename only |

#### Response Conversion (Anthropic -> OpenAI)

| Anthropic Field | OpenAI Field | Notes |
|----------------|-------------|-------|
| `id` | `id` | Pass-through |
| `content[0].text` | `choices[0].message.content` | Extract text from content block |
| `stop_reason: "end_turn"` | `finish_reason: "stop"` | Enum mapping |
| `stop_reason: "max_tokens"` | `finish_reason: "length"` | Enum mapping |
| `usage.input_tokens` | `usage.prompt_tokens` | Rename |
| `usage.output_tokens` | `usage.completion_tokens` | Rename |
| (computed) | `usage.total_tokens` | Sum of prompt + completion |
| (set) | `object` | `"chat.completion"` |
| (set) | `created` | Unix timestamp |

---

### Notes

- All error responses follow OpenAI's error format for client compatibility.
- The `model` field in responses always reflects the model name as sent by the client, not the provider's internal model identifier.
- `max_tokens` defaults to 4096 when not specified. For Anthropic, this is always sent (required parameter).
- Token `usage` in streaming responses is included in the final chunk only. Real-time per-chunk token counting is handled internally but not exposed in the SSE stream.
- Authentication will be added in F003. Current implementation accepts all requests without API key validation.
