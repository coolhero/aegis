# Feature Specification: F002 — LLM Gateway Core

**Feature Branch**: `002-llm-gateway-core`
**Created**: 2025-03-25
**Status**: Implemented
**Input**: Provider abstraction layer with OpenAI-compatible unified API, SSE streaming proxy, and Anthropic format conversion

## User Scenarios & Testing *(mandatory)*

### User Story 1 — OpenAI-Compatible Chat Completion (Priority: P1)

A client application developer sends a `POST /v1/chat/completions` request using the standard OpenAI Chat Completion format. The gateway processes the request, routes it to the correct provider based on the `model` field, and returns a complete JSON response in OpenAI format with usage statistics.

**Why this priority**: The non-streaming chat completion endpoint is the foundational API that all other features (streaming, routing, billing) build upon. Without it, the gateway has no purpose.

**Independent Test**: Send `POST /v1/chat/completions` with `model: "gpt-4o"` and `stream: false`, verify the response matches OpenAI Chat Completion format with `usage` field.

**Acceptance Scenarios**:

1. **Given** the gateway is running with OpenAI provider configured, **When** a client sends `POST /v1/chat/completions` with `model: "gpt-4o"`, `messages: [{"role": "user", "content": "Hello"}]`, and `stream: false`, **Then** the response is `200 OK` with `object: "chat.completion"`, `choices[0].message.content` contains text, and `usage` contains `prompt_tokens`, `completion_tokens`, `total_tokens`.

2. **Given** a valid chat completion request, **When** the request includes `temperature`, `max_tokens`, and `top_p` parameters, **Then** these parameters are forwarded to the provider and the response reflects the requested behavior.

3. **Given** a valid chat completion request with `messages` containing `system`, `user`, and `assistant` roles, **When** the request is processed, **Then** all message roles are correctly forwarded to the provider.

---

### User Story 2 — SSE Streaming Proxy (Priority: P2)

A client application needs real-time token-by-token response streaming for a chat UI. The developer sends a request with `stream: true` and receives Server-Sent Events with each token as it is generated, minimizing time-to-first-token (TTFT).

**Why this priority**: Streaming is the primary delivery mode for production chat applications. Without it, the gateway cannot serve real-time UIs.

**Independent Test**: Send `POST /v1/chat/completions` with `stream: true`, verify SSE events arrive incrementally with `Content-Type: text/event-stream` and terminate with `data: [DONE]`.

**Acceptance Scenarios**:

1. **Given** a chat completion request with `stream: true`, **When** the gateway processes it, **Then** the response has headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

2. **Given** a streaming request, **When** the provider generates tokens, **Then** each token is forwarded as `data: {chunk_json}\n\n` where `chunk_json` has `object: "chat.completion.chunk"` and `choices[0].delta.content` contains the token text.

3. **Given** a streaming request, **When** the provider completes generation, **Then** a final chunk with `finish_reason: "stop"` is sent, followed by `data: [DONE]\n\n`, and the connection closes.

4. **Given** a streaming request, **When** the provider encounters an error mid-stream (after some tokens have been sent), **Then** an SSE error event is sent to the client with OpenAI-compatible error format, followed by `data: [DONE]\n\n`.

---

### User Story 3 — Anthropic Provider Support (Priority: P3)

A client application developer wants to use Anthropic Claude models through the same OpenAI-compatible API. They send the exact same request format with `model: "claude-sonnet-4-20250514"` and receive responses in the same OpenAI format, without knowing that format conversion happens internally.

**Why this priority**: Multi-provider support is the core value proposition of the gateway. Without Anthropic support, the gateway is just an OpenAI proxy.

**Independent Test**: Send `POST /v1/chat/completions` with `model: "claude-sonnet-4-20250514"` and verify the response is in OpenAI format (not Anthropic Messages API format). Test both streaming and non-streaming.

**Acceptance Scenarios**:

1. **Given** a request with `model: "claude-sonnet-4-20250514"`, **When** the gateway processes it, **Then** the request is converted from OpenAI format to Anthropic Messages API format (system message extracted to top-level `system` parameter) and sent to the Anthropic API.

2. **Given** an Anthropic non-streaming response, **When** the gateway converts it, **Then** the response has `object: "chat.completion"`, `choices[0].message.content` (extracted from `content[0].text`), `finish_reason` mapped from `stop_reason` (`end_turn` -> `stop`, `max_tokens` -> `length`), and `usage` with `prompt_tokens`/`completion_tokens`/`total_tokens`.

3. **Given** an Anthropic streaming response, **When** the gateway converts it, **Then** Anthropic events (`content_block_delta`) are converted to OpenAI chunk format (`chat.completion.chunk` with `delta.content`), and the stream terminates with `data: [DONE]\n\n`.

4. **Given** a request with `model: "claude-sonnet-4-20250514"` and no `max_tokens` field, **When** the gateway converts the request, **Then** `max_tokens: 4096` is set as default (required by Anthropic API).

---

### User Story 4 — Provider Routing by Model Name (Priority: P4)

A platform operator configures multiple providers and models. When a client sends a request, the gateway looks up the model name in the database, identifies the correct provider, and routes the request to the appropriate adapter without client awareness of the provider infrastructure.

**Why this priority**: Model-based routing decouples clients from provider details, enabling transparent provider switching and model management.

**Independent Test**: Send requests with `model: "gpt-4o"` and `model: "claude-sonnet-4-20250514"`, verify they route to OpenAI and Anthropic respectively. Send request with unknown model, verify 400 error.

**Acceptance Scenarios**:

1. **Given** the model `gpt-4o` is registered with the OpenAI provider, **When** a request arrives with `model: "gpt-4o"`, **Then** the request is routed to the OpenAI adapter.

2. **Given** the model `claude-sonnet-4-20250514` is registered with the Anthropic provider, **When** a request arrives with `model: "claude-sonnet-4-20250514"`, **Then** the request is routed to the Anthropic adapter.

3. **Given** an unregistered model name, **When** a request arrives with `model: "nonexistent-model"`, **Then** the response is `400` with `error.type: "invalid_request_error"` and `error.code: "model_not_found"`.

4. **Given** a model exists but its provider is disabled (`enabled: false`), **When** a request arrives for that model, **Then** the response is `400` with a message indicating the provider is currently unavailable.

---

### Edge Cases

- **Empty messages array**: Request with `messages: []` returns 400 with `"messages must be non-empty"`.
- **System-only messages**: Request with only a system message (no user message) returns 400.
- **Very long context**: Request exceeding model's context window is forwarded to the provider, which returns its own error (502 upstream error).
- **Provider timeout**: If the provider does not respond within 30 seconds, the gateway returns 504.
- **Mid-stream connection drop**: If the client disconnects during streaming, the gateway cancels the provider request to avoid unnecessary token consumption.
- **Multiple system messages**: Multiple system messages in the messages array are concatenated with newlines for Anthropic conversion.
- **Concurrent requests**: Multiple simultaneous requests to different providers are handled independently (no shared state between requests).
- **Provider returns unexpected format**: Malformed provider responses are caught and returned as 502 with descriptive error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a `ProviderAdapter` interface with `chat()` (non-streaming) and `chatStream()` (streaming) methods. OpenAI and Anthropic adapters MUST implement this interface.
- **FR-002**: System MUST expose `POST /v1/chat/completions` endpoint accepting OpenAI Chat Completion request format.
- **FR-003**: System MUST support SSE streaming when `stream: true`. Chunks MUST be forwarded without buffering (minimize TTFT). Response MUST terminate with `data: [DONE]\n\n`.
- **FR-004**: System MUST convert OpenAI-format requests to Anthropic Messages API format and convert responses back. This includes system message handling, role mapping, and stop_reason mapping.
- **FR-005**: System MUST route requests to the correct provider adapter based on model name lookup in the Model entity.
- **FR-006**: System MUST include token usage (`prompt_tokens`, `completion_tokens`, `total_tokens`) from provider responses.
- **FR-007**: System MUST handle streaming errors by sending an SSE error event in OpenAI error format, followed by `data: [DONE]\n\n`.

### Key Entities

- **Provider**: LLM provider configuration. Attributes: `id` (UUID), `name` (unique), `type` (enum), `apiKeyEncrypted`, `baseUrl`, `enabled`, `healthStatus`, `weight`, `createdAt`, `updatedAt`.
- **Model**: Model configuration with provider mapping. Attributes: `id` (UUID), `providerId` (FK), `name` (unique), `displayName`, `inputPricePerToken`, `outputPricePerToken`, `maxTokens`, `contextWindow`, `enabled`, `createdAt`, `updatedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /v1/chat/completions` with `model: "gpt-4o"` returns a valid OpenAI Chat Completion JSON response.
- **SC-002**: `POST /v1/chat/completions` with `stream: true` returns `Content-Type: text/event-stream` with correctly formatted SSE chunks terminating in `data: [DONE]`.
- **SC-003**: `POST /v1/chat/completions` with `model: "claude-sonnet-4-20250514"` returns a response in OpenAI format (not Anthropic format).
- **SC-004**: Anthropic streaming converts `content_block_delta` events to OpenAI `chat.completion.chunk` format.
- **SC-005**: `model: "gpt-4o"` routes to OpenAI adapter; `model: "claude-sonnet-4-20250514"` routes to Anthropic adapter.
- **SC-006**: Unknown model returns `400` with `error.code: "model_not_found"`.
- **SC-007**: Non-streaming responses include `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`.
- **SC-008**: Streaming responses include `Cache-Control: no-cache`, `Connection: keep-alive` headers.
- **SC-009**: Mid-stream provider errors are forwarded as SSE error events.
- **SC-010**: `npm run build` compiles all F002 code without TypeScript errors.

## Assumptions

- F001 Foundation Setup is complete (ConfigModule, DatabaseModule, RedisModule operational).
- At least one provider API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) is available in the environment.
- Provider APIs (OpenAI, Anthropic) are reachable from the development network.
- No authentication is required for the gateway endpoint (deferred to F003).
- Token budget enforcement is not implemented (deferred to F004).
- Request logging/tracing is not implemented (deferred to F005).
- Provider pricing data in Model seeds is approximate and will be updated.
- The gateway handles single-choice completions only (`n=1`).

## Scope Boundaries

### In Scope
- ProviderAdapter interface and OpenAI/Anthropic adapter implementations
- POST /v1/chat/completions endpoint (OpenAI-compatible)
- SSE streaming proxy with real-time chunk forwarding
- OpenAI <-> Anthropic request/response format conversion
- Model name to provider routing via database lookup
- Token usage reporting (from provider usage field)
- Streaming error handling (mid-stream errors as SSE events)
- Provider and Model TypeORM entities with seed data

### Out of Scope
- Authentication and authorization (F003)
- Token budget management and rate limiting (F004)
- Request logging, tracing, and analytics (F005)
- Provider fallback and load balancing (F008)
- Semantic caching (F011)
- Function calling / tool use support
- Image and multimodal input support
- Batch API support
