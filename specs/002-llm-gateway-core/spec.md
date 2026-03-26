# Feature Specification: F002 — LLM Gateway Core

**Feature Branch**: `002-llm-gateway-core`
**Created**: 2025-03-25
**Status**: Implemented
**Input**: OpenAI 호환 통합 API, SSE 스트리밍 프록시, Anthropic 형식 변환을 포함한 프로바이더 추상화 레이어

## User Scenarios & Testing *(mandatory)*

### User Story 1 — OpenAI-Compatible Chat Completion (Priority: P1)

클라이언트 애플리케이션 개발자가 표준 OpenAI Chat Completion 형식으로 `POST /v1/chat/completions` 요청을 보낸다. 게이트웨이는 요청을 처리하고, `model` 필드를 기반으로 올바른 프로바이더로 라우팅하며, 사용량 통계가 포함된 OpenAI 형식의 완전한 JSON 응답을 반환한다.

**Why this priority**: 비스트리밍 chat completion 엔드포인트는 다른 모든 기능(스트리밍, 라우팅, 과금)이 기반하는 기초 API이다. 이것이 없으면 게이트웨이는 존재 의미가 없다.

**Independent Test**: `POST /v1/chat/completions`에 `model: "gpt-4o"`, `stream: false`로 요청을 보내고, 응답이 `usage` 필드가 포함된 OpenAI Chat Completion 형식과 일치하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 게이트웨이가 OpenAI 프로바이더가 구성된 상태로 실행 중일 때, **When** 클라이언트가 `POST /v1/chat/completions`에 `model: "gpt-4o"`, `messages: [{"role": "user", "content": "Hello"}]`, `stream: false`로 요청을 보내면, **Then** 응답은 `200 OK`이며 `object: "chat.completion"`, `choices[0].message.content`에 텍스트가 포함되고, `usage`에 `prompt_tokens`, `completion_tokens`, `total_tokens`가 포함된다.

2. **Given** 유효한 chat completion 요청이 있을 때, **When** 요청에 `temperature`, `max_tokens`, `top_p` 파라미터가 포함되면, **Then** 이 파라미터들이 프로바이더로 전달되고 응답은 요청된 동작을 반영한다.

3. **Given** `messages`에 `system`, `user`, `assistant` 역할이 포함된 유효한 chat completion 요청이 있을 때, **When** 요청이 처리되면, **Then** 모든 메시지 역할이 프로바이더로 올바르게 전달된다.

---

### User Story 2 — SSE Streaming Proxy (Priority: P2)

클라이언트 애플리케이션이 채팅 UI를 위한 실시간 토큰 단위 응답 스트리밍이 필요하다. 개발자는 `stream: true`로 요청을 보내고, 각 토큰이 생성될 때마다 Server-Sent Events를 수신하여 첫 번째 토큰 도착 시간(TTFT)을 최소화한다.

**Why this priority**: 스트리밍은 프로덕션 채팅 애플리케이션의 주요 전달 모드이다. 이것이 없으면 게이트웨이는 실시간 UI를 제공할 수 없다.

**Independent Test**: `POST /v1/chat/completions`에 `stream: true`로 요청을 보내고, `Content-Type: text/event-stream`과 함께 SSE 이벤트가 점진적으로 도착하며 `data: [DONE]`으로 종료되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** `stream: true`인 chat completion 요청이 있을 때, **When** 게이트웨이가 이를 처리하면, **Then** 응답 헤더에 `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`가 포함된다.

2. **Given** 스트리밍 요청이 있을 때, **When** 프로바이더가 토큰을 생성하면, **Then** 각 토큰이 `data: {chunk_json}\n\n` 형식으로 전달되며, `chunk_json`에는 `object: "chat.completion.chunk"`와 `choices[0].delta.content`에 토큰 텍스트가 포함된다.

3. **Given** 스트리밍 요청이 있을 때, **When** 프로바이더가 생성을 완료하면, **Then** `finish_reason: "stop"`이 포함된 최종 청크가 전송되고, 이어서 `data: [DONE]\n\n`이 전송되며 연결이 종료된다.

4. **Given** 스트리밍 요청이 있을 때, **When** 프로바이더가 스트림 중간에 오류를 만나면(일부 토큰이 전송된 후), **Then** OpenAI 호환 에러 형식의 SSE 에러 이벤트가 클라이언트에 전송되고, 이어서 `data: [DONE]\n\n`이 전송된다.

---

### User Story 3 — Anthropic Provider Support (Priority: P3)

클라이언트 애플리케이션 개발자가 동일한 OpenAI 호환 API를 통해 Anthropic Claude 모델을 사용하고자 한다. 동일한 요청 형식으로 `model: "claude-sonnet-4-20250514"`를 보내면, 내부적으로 형식 변환이 이루어지는 것을 알 필요 없이 동일한 OpenAI 형식의 응답을 받는다.

**Why this priority**: 멀티 프로바이더 지원이 게이트웨이의 핵심 가치 제안이다. Anthropic 지원이 없으면 게이트웨이는 단순한 OpenAI 프록시에 불과하다.

**Independent Test**: `POST /v1/chat/completions`에 `model: "claude-sonnet-4-20250514"`로 요청을 보내고, 응답이 OpenAI 형식(Anthropic Messages API 형식이 아닌)인지 확인한다. 스트리밍과 비스트리밍 모두 테스트한다.

**Acceptance Scenarios**:

1. **Given** `model: "claude-sonnet-4-20250514"`인 요청이 있을 때, **When** 게이트웨이가 이를 처리하면, **Then** 요청이 OpenAI 형식에서 Anthropic Messages API 형식으로 변환되고(system 메시지가 최상위 `system` 파라미터로 추출됨) Anthropic API로 전송된다.

2. **Given** Anthropic 비스트리밍 응답이 있을 때, **When** 게이트웨이가 이를 변환하면, **Then** 응답에 `object: "chat.completion"`, `choices[0].message.content`(`content[0].text`에서 추출), `stop_reason`에서 매핑된 `finish_reason`(`end_turn` -> `stop`, `max_tokens` -> `length`), 그리고 `prompt_tokens`/`completion_tokens`/`total_tokens`가 포함된 `usage`가 포함된다.

3. **Given** Anthropic 스트리밍 응답이 있을 때, **When** 게이트웨이가 이를 변환하면, **Then** Anthropic 이벤트(`content_block_delta`)가 OpenAI 청크 형식(`chat.completion.chunk`의 `delta.content`)으로 변환되고, 스트림이 `data: [DONE]\n\n`으로 종료된다.

4. **Given** `model: "claude-sonnet-4-20250514"`이고 `max_tokens` 필드가 없는 요청이 있을 때, **When** 게이트웨이가 요청을 변환하면, **Then** `max_tokens: 4096`이 기본값으로 설정된다(Anthropic API 필수 항목).

---

### User Story 4 — Provider Routing by Model Name (Priority: P4)

플랫폼 운영자가 여러 프로바이더와 모델을 구성한다. 클라이언트가 요청을 보내면, 게이트웨이가 데이터베이스에서 모델명을 조회하여 올바른 프로바이더를 식별하고, 클라이언트가 프로바이더 인프라를 인지하지 않아도 되도록 적절한 어댑터로 요청을 라우팅한다.

**Why this priority**: 모델 기반 라우팅은 클라이언트를 프로바이더 세부사항으로부터 분리하여, 투명한 프로바이더 전환과 모델 관리를 가능하게 한다.

**Independent Test**: `model: "gpt-4o"`와 `model: "claude-sonnet-4-20250514"`로 요청을 보내 각각 OpenAI와 Anthropic으로 라우팅되는지 확인한다. 알 수 없는 모델로 요청을 보내 400 에러를 확인한다.

**Acceptance Scenarios**:

1. **Given** 모델 `gpt-4o`가 OpenAI 프로바이더에 등록되어 있을 때, **When** `model: "gpt-4o"`인 요청이 도착하면, **Then** 요청이 OpenAI 어댑터로 라우팅된다.

2. **Given** 모델 `claude-sonnet-4-20250514`가 Anthropic 프로바이더에 등록되어 있을 때, **When** `model: "claude-sonnet-4-20250514"`인 요청이 도착하면, **Then** 요청이 Anthropic 어댑터로 라우팅된다.

3. **Given** 등록되지 않은 모델명이 있을 때, **When** `model: "nonexistent-model"`인 요청이 도착하면, **Then** 응답은 `400`이며 `error.type: "invalid_request_error"`, `error.code: "model_not_found"`가 포함된다.

4. **Given** 모델은 존재하지만 해당 프로바이더가 비활성화(`enabled: false`)되어 있을 때, **When** 해당 모델에 대한 요청이 도착하면, **Then** 응답은 `400`이며 프로바이더가 현재 사용 불가능함을 나타내는 메시지가 포함된다.

---

### Edge Cases

- **빈 messages 배열**: `messages: []`인 요청은 `"messages must be non-empty"`와 함께 400을 반환한다.
- **system 메시지만 있는 경우**: system 메시지만 있고 user 메시지가 없는 요청은 400을 반환한다.
- **매우 긴 컨텍스트**: 모델의 컨텍스트 윈도우를 초과하는 요청은 프로바이더로 전달되며, 프로바이더가 자체 에러를 반환한다(502 upstream error).
- **프로바이더 타임아웃**: 프로바이더가 30초 이내에 응답하지 않으면 게이트웨이가 504를 반환한다.
- **스트리밍 중 연결 끊김**: 스트리밍 중 클라이언트가 연결을 끊으면, 게이트웨이가 불필요한 토큰 소비를 방지하기 위해 프로바이더 요청을 취소한다.
- **복수 system 메시지**: messages 배열의 복수 system 메시지는 Anthropic 변환 시 줄바꿈으로 연결된다.
- **동시 요청**: 서로 다른 프로바이더에 대한 복수 동시 요청은 독립적으로 처리된다(요청 간 공유 상태 없음).
- **프로바이더가 예상치 못한 형식 반환**: 잘못된 형식의 프로바이더 응답은 캐치되어 설명적 에러와 함께 502로 반환된다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `chat()` (비스트리밍)와 `chatStream()` (스트리밍) 메서드를 가진 `ProviderAdapter` 인터페이스를 정의해야 한다(MUST). OpenAI와 Anthropic 어댑터는 이 인터페이스를 구현해야 한다(MUST).
- **FR-002**: 시스템은 OpenAI Chat Completion 요청 형식을 수락하는 `POST /v1/chat/completions` 엔드포인트를 노출해야 한다(MUST).
- **FR-003**: 시스템은 `stream: true`일 때 SSE 스트리밍을 지원해야 한다(MUST). 청크는 버퍼링 없이 전달되어야 한다(MUST)(TTFT 최소화). 응답은 `data: [DONE]\n\n`으로 종료되어야 한다(MUST).
- **FR-004**: 시스템은 OpenAI 형식 요청을 Anthropic Messages API 형식으로 변환하고 응답을 다시 변환해야 한다(MUST). 여기에는 system 메시지 처리, 역할 매핑, stop_reason 매핑이 포함된다.
- **FR-005**: 시스템은 Model 엔티티의 모델명 조회를 기반으로 올바른 프로바이더 어댑터로 요청을 라우팅해야 한다(MUST).
- **FR-006**: 시스템은 프로바이더 응답의 토큰 사용량(`prompt_tokens`, `completion_tokens`, `total_tokens`)을 포함해야 한다(MUST).
- **FR-007**: 시스템은 스트리밍 에러를 OpenAI 에러 형식의 SSE 에러 이벤트로 전송하고, 이어서 `data: [DONE]\n\n`을 전송하여 처리해야 한다(MUST).

### Key Entities

- **Provider**: LLM 프로바이더 구성. 속성: `id` (UUID), `name` (unique), `type` (enum), `apiKeyEncrypted`, `baseUrl`, `enabled`, `healthStatus`, `weight`, `createdAt`, `updatedAt`.
- **Model**: 프로바이더 매핑이 포함된 모델 구성. 속성: `id` (UUID), `providerId` (FK), `name` (unique), `displayName`, `inputPricePerToken`, `outputPricePerToken`, `maxTokens`, `contextWindow`, `enabled`, `createdAt`, `updatedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /v1/chat/completions`에 `model: "gpt-4o"`로 요청하면 유효한 OpenAI Chat Completion JSON 응답을 반환한다.
- **SC-002**: `POST /v1/chat/completions`에 `stream: true`로 요청하면 올바르게 포맷된 SSE 청크가 `data: [DONE]`으로 종료되는 `Content-Type: text/event-stream`을 반환한다.
- **SC-003**: `POST /v1/chat/completions`에 `model: "claude-sonnet-4-20250514"`로 요청하면 OpenAI 형식(Anthropic 형식이 아닌)의 응답을 반환한다.
- **SC-004**: Anthropic 스트리밍이 `content_block_delta` 이벤트를 OpenAI `chat.completion.chunk` 형식으로 변환한다.
- **SC-005**: `model: "gpt-4o"`는 OpenAI 어댑터로 라우팅되고, `model: "claude-sonnet-4-20250514"`는 Anthropic 어댑터로 라우팅된다.
- **SC-006**: 알 수 없는 모델은 `error.code: "model_not_found"`와 함께 `400`을 반환한다.
- **SC-007**: 비스트리밍 응답에 `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`가 포함된다.
- **SC-008**: 스트리밍 응답에 `Cache-Control: no-cache`, `Connection: keep-alive` 헤더가 포함된다.
- **SC-009**: 스트림 중간 프로바이더 에러가 SSE 에러 이벤트로 전달된다.
- **SC-010**: `npm run build`가 모든 F002 코드를 TypeScript 에러 없이 컴파일한다.

## Assumptions

- F001 Foundation Setup이 완료되어 있다(ConfigModule, DatabaseModule, RedisModule 작동 중).
- 하나 이상의 프로바이더 API 키(`OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`)가 환경에 설정되어 있다.
- 프로바이더 API(OpenAI, Anthropic)가 개발 네트워크에서 접근 가능하다.
- 게이트웨이 엔드포인트에 인증이 필요하지 않다(F003으로 연기).
- 토큰 예산 집행이 구현되지 않았다(F004로 연기).
- 요청 로깅/추적이 구현되지 않았다(F005로 연기).
- Model 시드의 프로바이더 가격 데이터는 대략적이며 업데이트될 예정이다.
- 게이트웨이는 단일 선택 완성만 처리한다(`n=1`).

## Scope Boundaries

### In Scope
- ProviderAdapter 인터페이스와 OpenAI/Anthropic 어댑터 구현
- POST /v1/chat/completions 엔드포인트 (OpenAI 호환)
- 실시간 청크 전달을 포함한 SSE 스트리밍 프록시
- OpenAI <-> Anthropic 요청/응답 형식 변환
- 데이터베이스 조회를 통한 모델명 → 프로바이더 라우팅
- 토큰 사용량 리포팅 (프로바이더 usage 필드 기반)
- 스트리밍 에러 처리 (스트림 중간 에러를 SSE 이벤트로)
- Provider 및 Model TypeORM 엔티티와 시드 데이터

### Out of Scope
- 인증 및 권한 관리 (F003)
- 토큰 예산 관리 및 속도 제한 (F004)
- 요청 로깅, 추적, 분석 (F005)
- 프로바이더 폴백 및 로드 밸런싱 (F008)
- 시맨틱 캐싱 (F011)
- Function calling / tool use 지원
- 이미지 및 멀티모달 입력 지원
- Batch API 지원
