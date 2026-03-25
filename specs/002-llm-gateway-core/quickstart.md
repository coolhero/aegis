# Quickstart: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25

## Prerequisites

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| F001 Foundation | Completed | `curl localhost:3000/health` returns 200 |

### Required API Keys

At least one provider API key is needed to test the gateway:

| Variable | Provider | Get it from |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Anthropic | https://console.anthropic.com/settings/keys |

## Setup

### 1. Ensure F001 Infrastructure is Running

```bash
docker compose up -d
npm run start:dev
```

Verify health:

```bash
curl http://localhost:3000/health
```

### 2. Add API Keys to Environment

Add to your `.env` file:

```bash
# At least one is required
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

Restart the application after updating `.env`:

```bash
# Ctrl+C to stop, then:
npm run start:dev
```

### 3. Seed Provider and Model Data

The migration seeds default provider and model records automatically. Verify by checking the application logs for seed confirmation at startup.

## Test: Non-Streaming Request

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

Expected response:

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

Expected response (same OpenAI-compatible format):

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

## Test: Streaming Request (SSE)

### OpenAI Streaming

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

Expected output (SSE events, one per line):

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"1"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":","},"finish_reason":null}]}

...

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1711360000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

```

### Anthropic Streaming

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

Expected output: Same SSE format as OpenAI (the gateway converts Anthropic streaming events to OpenAI chunk format).

## Test: Error Handling

### Unknown Model

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nonexistent-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq .
```

Expected response (400):

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

### Missing Messages

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o"
  }' | jq .
```

Expected response (400):

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

### Invalid API Key (Provider Error)

If the API key is invalid or missing, the provider returns an authentication error:

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

## Verify SSE Headers

```bash
curl -sI -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hi"}],
    "stream": true
  }' 2>&1 | head -10
```

Expected headers include:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## Common Issues

### "Unknown model" for a valid model name

The model seed data may not have been applied. Check that the `models` table has entries:

```bash
# Connect to postgres
docker compose exec postgres psql -U aegis -d aegis -c "SELECT name, enabled FROM models;"
```

### Provider returns 401/403

API key is invalid or not set. Check your `.env`:

```bash
grep -E "OPENAI_API_KEY|ANTHROPIC_API_KEY" .env
```

### Streaming response hangs

Ensure you use `curl -N` (no-buffer) for streaming requests. Without `-N`, curl buffers the entire response before displaying.

### Connection refused on port 3000

The application is not running. Start it:

```bash
npm run start:dev
```

### TypeORM entity sync errors

If entity changes are not reflected, restart the dev server. In development mode, `synchronize: true` auto-syncs schema on startup.
