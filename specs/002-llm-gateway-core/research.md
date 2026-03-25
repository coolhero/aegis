# Research: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25
**Phase**: 0 (Technology Research)

## 1. OpenAI SDK vs Raw HTTP

### Options Evaluated

| Criteria | `openai` npm package | Raw HTTP (fetch/axios) |
|----------|---------------------|----------------------|
| Type safety | Full TypeScript types for all endpoints | Manual type definitions needed |
| Streaming support | Built-in async iterator for SSE chunks | Manual SSE parsing (EventSource or line-by-line) |
| Authentication | Automatic header injection | Manual `Authorization: Bearer` header |
| Error handling | Typed `APIError` with status codes, retries | Manual error parsing and retry logic |
| Rate limit handling | Built-in retry with backoff | Manual `Retry-After` header parsing |
| Maintenance | Kept in sync with API changes by OpenAI | Must track API changes manually |
| Bundle size | ~50KB (tree-shakeable) | Zero additional dependency |
| Timeout control | Configurable per-request | Full control |

### Decision: **`openai` npm package**

**Rationale**:
1. **Official SDK**: Maintained by OpenAI, always up-to-date with API changes. Reduces maintenance burden.
2. **Typed streaming**: `stream.on('chunk')` and async iterator patterns provide type-safe streaming without manual SSE parsing.
3. **Structured error types**: `APIError`, `AuthenticationError`, `RateLimitError` classes enable precise error handling in the adapter layer.
4. **AEGIS-specific**: The gateway proxies OpenAI requests transparently. Using the official SDK ensures wire-format compatibility without manual serialization.

**Trade-off acknowledged**: Raw HTTP would give more control over connection pooling and timeout behavior. However, the SDK's built-in retry and streaming capabilities outweigh the marginal control loss.

**Reference**: https://github.com/openai/openai-node

---

## 2. Anthropic SDK vs Raw HTTP

### Options Evaluated

| Criteria | `@anthropic-ai/sdk` | Raw HTTP (fetch/axios) |
|----------|---------------------|----------------------|
| Type safety | Full TypeScript types for Messages API | Manual type definitions |
| Streaming support | Built-in SSE stream with typed events | Manual SSE parsing |
| Message format | Native Anthropic `content_block` types | Manual content block construction |
| System message handling | Dedicated `system` parameter | Must know API structure |
| Token counting | `usage` field in response | Same (API feature) |
| Error handling | Typed errors with status codes | Manual parsing |
| Beta features | Header injection for beta APIs | Manual header management |

### Decision: **`@anthropic-ai/sdk`**

**Rationale**:
1. **Messages API complexity**: Anthropic's Messages API has a distinct structure (content blocks, `system` as top-level param, tool use blocks). The SDK abstracts these correctly.
2. **Streaming event types**: Anthropic streaming uses multiple event types (`message_start`, `content_block_start`, `content_block_delta`, `message_delta`, `message_stop`). The SDK provides typed handlers for each.
3. **Format conversion baseline**: Having typed Anthropic request/response objects makes the OpenAI-to-Anthropic conversion adapter more reliable and maintainable.
4. **AEGIS-specific**: The Anthropic adapter needs to convert OpenAI-format requests to Anthropic format. Using the official SDK ensures the target format is always correct.

**Reference**: https://github.com/anthropics/anthropic-sdk-typescript

---

## 3. Provider Abstraction Pattern

### Options Evaluated

| Criteria | Adapter Pattern | Strategy Pattern | Proxy Pattern |
|----------|----------------|-----------------|---------------|
| Interface contract | Explicit interface per adapter | Interchangeable algorithms | Same interface as target |
| Runtime selection | Registry lookup by key | Injected at construction | Transparent forwarding |
| New provider addition | Implement interface + register | Implement strategy + inject | Wrap target + register |
| Format conversion | Natural (adapter's purpose) | Possible but awkward | Not designed for conversion |
| NestJS integration | Injectable services + registry | Injectable + provider token | Injectable + dynamic proxy |
| Testability | Mock adapter per provider | Mock strategy | Mock proxy target |

### Decision: **Adapter Pattern with Registry**

**Rationale**:
1. **Natural fit**: The core problem is converting between incompatible interfaces (OpenAI format vs Anthropic format). This is the textbook use case for the Adapter pattern.
2. **Registry for routing**: A `ProviderRegistry` maps model names to adapter instances, enabling `model: "gpt-4o"` to route to the OpenAI adapter and `model: "claude-sonnet-4-20250514"` to route to the Anthropic adapter.
3. **Extensibility**: Adding a new provider (e.g., Google Gemini) requires only implementing `ProviderAdapter` and registering it. No changes to the gateway service or controller.
4. **NestJS alignment**: Each adapter is an `@Injectable()` service. The registry is also injectable, using NestJS's DI to resolve adapters.

**Implementation pattern**:
```
ProviderAdapter (interface)
  -> OpenAiAdapter (implements ProviderAdapter)
  -> AnthropicAdapter (implements ProviderAdapter, converts formats)

ProviderRegistry
  -> resolveAdapter(modelName: string): ProviderAdapter
  -> uses Model entity to find provider, then returns matching adapter
```

---

## 4. SSE Streaming Implementation

### Options Evaluated

| Criteria | Async Generators | ReadableStream (Web API) | Node.js Stream pipe |
|----------|-----------------|------------------------|-------------------|
| NestJS support | Return `Observable` or use `@Sse()` | Manual response handling | Manual `res.pipe()` |
| Backpressure | Manual (yield pauses on consumer) | Built-in | Built-in |
| Error propagation | `try/catch` + `throw` | `cancel()` on reader | `error` event |
| Chunk transformation | Natural `yield` per transformed chunk | `TransformStream` | `Transform` stream |
| Memory footprint | Minimal (one chunk at a time) | Minimal | Minimal |
| TypeScript ergonomics | Clean `async function*` syntax | Verbose reader/writer API | Event-based, less typed |
| Provider SDK compatibility | OpenAI SDK returns async iterable | N/A | N/A |

### Decision: **Async Generators with NestJS StreamableFile/raw Response**

**Rationale**:
1. **SDK alignment**: Both `openai` and `@anthropic-ai/sdk` return async iterables for streaming. Async generators compose naturally with these.
2. **Transform pipeline**: Each provider adapter's `chatStream()` method returns an `AsyncGenerator<ChatCompletionChunk>`. The gateway service consumes it, transforms chunks (for Anthropic), and yields OpenAI-format chunks.
3. **SSE output**: The controller iterates the generator, formatting each chunk as `data: ${JSON.stringify(chunk)}\n\n` and writing to the raw `Response` object with `Content-Type: text/event-stream`.
4. **Error handling**: `try/catch` around `for await` naturally catches provider errors mid-stream, enabling SSE error event emission.

**Implementation approach**:
```typescript
// Adapter returns async generator
async *chatStream(req): AsyncGenerator<ChatCompletionChunk> {
  for await (const chunk of sdk.stream()) {
    yield transformedChunk;
  }
}

// Controller writes SSE
for await (const chunk of service.chatStream(req)) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();
```

---

## 5. Token Counting Strategy

### Options Evaluated

| Criteria | `tiktoken` (client-side) | Provider `usage` field | Hybrid (estimate + reconcile) |
|----------|------------------------|----------------------|------------------------------|
| Accuracy | High for OpenAI models, N/A for Anthropic | Exact (ground truth) | Exact after reconciliation |
| Streaming support | Count per chunk in real-time | Only in final message | Real-time estimate + final exact |
| Cross-provider | OpenAI only (BPE tokenizer) | Universal (each provider reports) | Best of both |
| Latency | CPU cost per chunk | Zero (piggyback on response) | Minimal CPU + zero |
| Dependency | `tiktoken` WASM (~4MB) | None | Optional `tiktoken` |
| Maintenance | Must update tokenizer per model | Provider handles it | Provider handles final |

### Decision: **Provider `usage` field as ground truth**

**Rationale**:
1. **Cross-provider accuracy**: Each provider's `usage` field is authoritative for its own models. No need to maintain separate tokenizer logic per provider.
2. **Simplicity**: Avoid the `tiktoken` WASM dependency and its model-specific encoding tables.
3. **Streaming flow**: For non-streaming requests, `usage` is in the response. For streaming, the final chunk (or `message_delta` for Anthropic) contains usage data. The gateway captures this.
4. **AEGIS-specific**: Token budget management (F004) needs accurate counts for billing. Provider-reported usage is the only legally defensible source for cost calculation.

**Trade-off acknowledged**: Real-time token counting during streaming would enable mid-stream budget enforcement. This is deferred to F004 where `tiktoken` may be introduced as an estimation layer, with provider usage as reconciliation.

---

## 6. OpenAI-Compatible API as Universal Standard

### Why OpenAI Format

| Factor | Rationale |
|--------|-----------|
| **Industry adoption** | OpenAI Chat Completion format is the de facto standard. LiteLLM, Ollama, vLLM, Azure OpenAI all use it. |
| **Client ecosystem** | OpenAI SDK clients (Python, Node, Go) can connect to any OpenAI-compatible API without modification. |
| **Tool integration** | LangChain, LlamaIndex, Vercel AI SDK all have first-class OpenAI provider support. |
| **Migration path** | Switching between providers is transparent to clients. Only the `model` field changes. |
| **Streaming format** | SSE with `data: {chunk}\n\n` and `data: [DONE]\n\n` is well-understood by all streaming clients. |

### Conversion Strategy

```
Client Request (OpenAI format)
  -> Gateway receives
  -> Route to adapter by model name
  -> If OpenAI adapter: forward as-is to OpenAI API
  -> If Anthropic adapter: convert to Anthropic Messages API format
  -> Provider responds
  -> If Anthropic: convert response back to OpenAI format
  -> Return to client (always OpenAI format)
```

**Key conversion rules (OpenAI -> Anthropic)**:
- `messages[role=system]` -> top-level `system` parameter
- `messages[role=user/assistant]` -> `messages` array with content blocks
- `max_tokens` -> `max_tokens` (required in Anthropic, optional in OpenAI)
- `temperature`, `top_p` -> direct mapping
- `stream: true` -> `stream: true` (both support it)

**Key conversion rules (Anthropic -> OpenAI response)**:
- `content[0].text` -> `choices[0].message.content`
- `stop_reason` -> `choices[0].finish_reason` mapping (`end_turn` -> `stop`, `max_tokens` -> `length`)
- `usage.input_tokens` -> `usage.prompt_tokens`
- `usage.output_tokens` -> `usage.completion_tokens`

---

## 7. Summary of Technology Choices

| Component | Choice | Package |
|-----------|--------|---------|
| OpenAI Client | Official SDK | `openai` |
| Anthropic Client | Official SDK | `@anthropic-ai/sdk` |
| Abstraction Pattern | Adapter + Registry | Custom (NestJS Injectable) |
| Streaming | Async Generators | Native TypeScript |
| Token Counting | Provider usage field | No additional dependency |
| API Format | OpenAI-compatible | Industry standard |
