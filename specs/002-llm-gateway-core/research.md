# Research: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25
**Phase**: 0 (기술 리서치)

## 1. OpenAI SDK vs Raw HTTP

### 평가된 옵션

| 기준 | `openai` npm 패키지 | Raw HTTP (fetch/axios) |
|----------|---------------------|----------------------|
| 타입 안전성 | 모든 엔드포인트에 대한 완전한 TypeScript 타입 | 수동 타입 정의 필요 |
| 스트리밍 지원 | SSE 청크를 위한 내장 async iterator | 수동 SSE 파싱 (EventSource 또는 라인 단위) |
| 인증 | 자동 헤더 주입 | 수동 `Authorization: Bearer` 헤더 |
| 에러 처리 | 상태 코드와 재시도가 포함된 타입화된 `APIError` | 수동 에러 파싱 및 재시도 로직 |
| 속도 제한 처리 | 내장 백오프 재시도 | 수동 `Retry-After` 헤더 파싱 |
| 유지보수 | OpenAI에 의해 API 변경과 동기화 유지 | API 변경을 수동으로 추적해야 함 |
| 번들 크기 | ~50KB (tree-shakeable) | 추가 의존성 없음 |
| 타임아웃 제어 | 요청별 설정 가능 | 완전한 제어 |

### 결정: **`openai` npm 패키지**

**근거**:
1. **공식 SDK**: OpenAI가 유지보수하며 항상 API 변경에 맞춰 최신 상태. 유지보수 부담을 줄여준다.
2. **타입화된 스트리밍**: `stream.on('chunk')` 및 async iterator 패턴이 수동 SSE 파싱 없이 타입 안전한 스트리밍을 제공한다.
3. **구조화된 에러 타입**: `APIError`, `AuthenticationError`, `RateLimitError` 클래스가 어댑터 레이어에서 정밀한 에러 처리를 가능하게 한다.
4. **AEGIS 특화**: 게이트웨이가 OpenAI 요청을 투명하게 프록시한다. 공식 SDK를 사용하면 수동 직렬화 없이 와이어 포맷 호환성을 보장한다.

**인정된 트레이드오프**: Raw HTTP가 커넥션 풀링과 타임아웃 동작에 대해 더 많은 제어를 제공할 수 있다. 그러나 SDK의 내장 재시도 및 스트리밍 기능이 미미한 제어 손실을 상회한다.

**Reference**: https://github.com/openai/openai-node

---

## 2. Anthropic SDK vs Raw HTTP

### 평가된 옵션

| 기준 | `@anthropic-ai/sdk` | Raw HTTP (fetch/axios) |
|----------|---------------------|----------------------|
| 타입 안전성 | Messages API에 대한 완전한 TypeScript 타입 | 수동 타입 정의 |
| 스트리밍 지원 | 타입화된 이벤트를 포함한 내장 SSE 스트림 | 수동 SSE 파싱 |
| 메시지 형식 | 네이티브 Anthropic `content_block` 타입 | 수동 content block 구성 |
| system 메시지 처리 | 전용 `system` 파라미터 | API 구조를 알아야 함 |
| 토큰 카운팅 | 응답의 `usage` 필드 | 동일 (API 기능) |
| 에러 처리 | 상태 코드가 포함된 타입화된 에러 | 수동 파싱 |
| 베타 기능 | 베타 API를 위한 헤더 주입 | 수동 헤더 관리 |

### 결정: **`@anthropic-ai/sdk`**

**근거**:
1. **Messages API 복잡성**: Anthropic의 Messages API는 고유한 구조(content block, 최상위 `system` 파라미터, tool use block)를 가진다. SDK가 이를 올바르게 추상화한다.
2. **스트리밍 이벤트 타입**: Anthropic 스트리밍은 여러 이벤트 타입(`message_start`, `content_block_start`, `content_block_delta`, `message_delta`, `message_stop`)을 사용한다. SDK가 각각에 대한 타입화된 핸들러를 제공한다.
3. **형식 변환 기준**: 타입화된 Anthropic 요청/응답 객체가 있으면 OpenAI-Anthropic 변환 어댑터가 더 안정적이고 유지보수하기 쉽다.
4. **AEGIS 특화**: Anthropic 어댑터가 OpenAI 형식 요청을 Anthropic 형식으로 변환해야 한다. 공식 SDK를 사용하면 대상 형식이 항상 올바른 것을 보장한다.

**Reference**: https://github.com/anthropics/anthropic-sdk-typescript

---

## 3. 프로바이더 추상화 패턴

### 평가된 옵션

| 기준 | Adapter 패턴 | Strategy 패턴 | Proxy 패턴 |
|----------|----------------|-----------------|---------------|
| 인터페이스 계약 | 어댑터별 명시적 인터페이스 | 교환 가능한 알고리즘 | 대상과 동일한 인터페이스 |
| 런타임 선택 | 키 기반 레지스트리 조회 | 생성 시 주입 | 투명한 전달 |
| 새 프로바이더 추가 | 인터페이스 구현 + 등록 | 전략 구현 + 주입 | 대상 래핑 + 등록 |
| 형식 변환 | 자연스러움 (어댑터의 목적) | 가능하지만 어색함 | 변환을 위해 설계되지 않음 |
| NestJS 통합 | Injectable 서비스 + 레지스트리 | Injectable + 프로바이더 토큰 | Injectable + 동적 프록시 |
| 테스트 용이성 | 프로바이더별 모의 어댑터 | 모의 전략 | 모의 프록시 대상 |

### 결정: **Adapter 패턴 + Registry**

**근거**:
1. **자연스러운 적합성**: 핵심 문제가 호환되지 않는 인터페이스(OpenAI 형식 vs Anthropic 형식) 간의 변환이다. 이는 Adapter 패턴의 교과서적 사용 사례이다.
2. **라우팅을 위한 Registry**: `ProviderRegistry`가 모델명을 어댑터 인스턴스에 매핑하여, `model: "gpt-4o"`가 OpenAI 어댑터로, `model: "claude-sonnet-4-20250514"`가 Anthropic 어댑터로 라우팅되게 한다.
3. **확장성**: 새 프로바이더(예: Google Gemini) 추가 시 `ProviderAdapter` 구현과 등록만 필요하다. 게이트웨이 서비스나 컨트롤러 변경이 불필요하다.
4. **NestJS 정합성**: 각 어댑터가 `@Injectable()` 서비스이다. 레지스트리도 Injectable이며, NestJS의 DI를 사용하여 어댑터를 해석한다.

**구현 패턴**:
```
ProviderAdapter (interface)
  -> OpenAiAdapter (implements ProviderAdapter)
  -> AnthropicAdapter (implements ProviderAdapter, converts formats)

ProviderRegistry
  -> resolveAdapter(modelName: string): ProviderAdapter
  -> uses Model entity to find provider, then returns matching adapter
```

---

## 4. SSE 스트리밍 구현

### 평가된 옵션

| 기준 | Async Generators | ReadableStream (Web API) | Node.js Stream pipe |
|----------|-----------------|------------------------|-------------------|
| NestJS 지원 | `Observable` 반환 또는 `@Sse()` 사용 | 수동 응답 처리 | 수동 `res.pipe()` |
| Backpressure | 수동 (소비자에서 yield가 일시 중지) | 내장 | 내장 |
| 에러 전파 | `try/catch` + `throw` | 리더의 `cancel()` | `error` 이벤트 |
| 청크 변환 | 변환된 청크별 자연스러운 `yield` | `TransformStream` | `Transform` 스트림 |
| 메모리 풋프린트 | 최소 (한 번에 하나의 청크) | 최소 | 최소 |
| TypeScript 편의성 | 깔끔한 `async function*` 문법 | 장황한 reader/writer API | 이벤트 기반, 타입 부족 |
| 프로바이더 SDK 호환성 | OpenAI SDK가 async iterable 반환 | 해당 없음 | 해당 없음 |

### 결정: **Async Generators + NestJS StreamableFile/raw Response**

**근거**:
1. **SDK 정합성**: `openai`와 `@anthropic-ai/sdk` 모두 스트리밍에 async iterable을 반환한다. Async generator가 이들과 자연스럽게 합성된다.
2. **변환 파이프라인**: 각 프로바이더 어댑터의 `chatStream()` 메서드가 `AsyncGenerator<ChatCompletionChunk>`를 반환한다. 게이트웨이 서비스가 이를 소비하고, 청크를 변환(Anthropic의 경우)하여 OpenAI 형식 청크를 yield한다.
3. **SSE 출력**: 컨트롤러가 generator를 반복하며, 각 청크를 `data: ${JSON.stringify(chunk)}\n\n`으로 포맷하고 `Content-Type: text/event-stream`으로 raw `Response` 객체에 쓴다.
4. **에러 처리**: `for await` 주위의 `try/catch`가 자연스럽게 스트림 중간 프로바이더 에러를 캐치하여 SSE 에러 이벤트 발송을 가능하게 한다.

**구현 접근법**:
```typescript
// 어댑터가 async generator를 반환
async *chatStream(req): AsyncGenerator<ChatCompletionChunk> {
  for await (const chunk of sdk.stream()) {
    yield transformedChunk;
  }
}

// 컨트롤러가 SSE를 쓴다
for await (const chunk of service.chatStream(req)) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();
```

---

## 5. 토큰 카운팅 전략

### 평가된 옵션

| 기준 | `tiktoken` (클라이언트 측) | 프로바이더 `usage` 필드 | 하이브리드 (추정 + 보정) |
|----------|------------------------|----------------------|------------------------------|
| 정확도 | OpenAI 모델은 높음, Anthropic은 해당 없음 | 정확 (ground truth) | 보정 후 정확 |
| 스트리밍 지원 | 청크별 실시간 카운트 | 최종 메시지에서만 | 실시간 추정 + 최종 정확값 |
| 크로스 프로바이더 | OpenAI만 (BPE tokenizer) | 범용 (각 프로바이더가 보고) | 양쪽의 장점 |
| 지연시간 | 청크별 CPU 비용 | 제로 (응답에 편승) | 최소 CPU + 제로 |
| 의존성 | `tiktoken` WASM (~4MB) | 없음 | 선택적 `tiktoken` |
| 유지보수 | 모델별 토크나이저 업데이트 필요 | 프로바이더가 처리 | 프로바이더가 최종 처리 |

### 결정: **프로바이더 `usage` 필드를 ground truth로 사용**

**근거**:
1. **크로스 프로바이더 정확도**: 각 프로바이더의 `usage` 필드가 자체 모델에 대해 권위적이다. 프로바이더별 별도 토크나이저 로직을 유지할 필요가 없다.
2. **단순성**: `tiktoken` WASM 의존성과 모델별 인코딩 테이블을 피한다.
3. **스트리밍 흐름**: 비스트리밍 요청은 응답에 `usage`가 포함된다. 스트리밍은 최종 청크(또는 Anthropic의 `message_delta`)에 usage 데이터가 포함된다. 게이트웨이가 이를 캡처한다.
4. **AEGIS 특화**: 토큰 예산 관리(F004)가 과금을 위해 정확한 카운트가 필요하다. 프로바이더가 보고하는 usage가 비용 계산을 위한 유일한 법적 근거가 되는 출처이다.

**인정된 트레이드오프**: 스트리밍 중 실시간 토큰 카운팅은 스트림 중간 예산 집행을 가능하게 할 것이다. 이는 F004로 연기되며, `tiktoken`이 추정 레이어로 도입되고 프로바이더 usage가 보정에 사용될 수 있다.

---

## 6. OpenAI 호환 API를 유니버셜 표준으로

### OpenAI 형식을 사용하는 이유

| 요소 | 근거 |
|--------|-----------|
| **업계 채택** | OpenAI Chat Completion 형식이 사실상의 표준이다. LiteLLM, Ollama, vLLM, Azure OpenAI 모두 이를 사용한다. |
| **클라이언트 생태계** | OpenAI SDK 클라이언트(Python, Node, Go)가 수정 없이 모든 OpenAI 호환 API에 연결할 수 있다. |
| **도구 통합** | LangChain, LlamaIndex, Vercel AI SDK 모두 일급 OpenAI 프로바이더 지원을 가진다. |
| **마이그레이션 경로** | 프로바이더 간 전환이 클라이언트에 투명하다. `model` 필드만 변경된다. |
| **스트리밍 형식** | `data: {chunk}\n\n`과 `data: [DONE]\n\n`을 사용하는 SSE가 모든 스트리밍 클라이언트에서 잘 이해된다. |

### 변환 전략

```
Client Request (OpenAI format)
  -> 게이트웨이가 수신
  -> 모델명으로 어댑터에 라우팅
  -> OpenAI 어댑터인 경우: OpenAI API로 그대로 전달
  -> Anthropic 어댑터인 경우: Anthropic Messages API 형식으로 변환
  -> 프로바이더가 응답
  -> Anthropic인 경우: 응답을 다시 OpenAI 형식으로 변환
  -> 클라이언트에 반환 (항상 OpenAI 형식)
```

**주요 변환 규칙 (OpenAI -> Anthropic)**:
- `messages[role=system]` -> 최상위 `system` 파라미터
- `messages[role=user/assistant]` -> content block이 포함된 `messages` 배열
- `max_tokens` -> `max_tokens` (Anthropic에서 필수, OpenAI에서 선택)
- `temperature`, `top_p` -> 직접 매핑
- `stream: true` -> `stream: true` (둘 다 지원)

**주요 변환 규칙 (Anthropic -> OpenAI 응답)**:
- `content[0].text` -> `choices[0].message.content`
- `stop_reason` -> `choices[0].finish_reason` 매핑 (`end_turn` -> `stop`, `max_tokens` -> `length`)
- `usage.input_tokens` -> `usage.prompt_tokens`
- `usage.output_tokens` -> `usage.completion_tokens`

---

## 7. 기술 선택 요약

| 컴포넌트 | 선택 | 패키지 |
|-----------|--------|---------|
| OpenAI 클라이언트 | 공식 SDK | `openai` |
| Anthropic 클라이언트 | 공식 SDK | `@anthropic-ai/sdk` |
| 추상화 패턴 | Adapter + Registry | Custom (NestJS Injectable) |
| 스트리밍 | Async Generators | Native TypeScript |
| 토큰 카운팅 | 프로바이더 usage 필드 | 추가 의존성 없음 |
| API 형식 | OpenAI 호환 | 업계 표준 |
