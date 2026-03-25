# Pre-Context: F002 — LLM Gateway Core

## Feature Summary
OpenAI, Anthropic 프로바이더 추상화 레이어와 OpenAI-호환 통합 API (`/v1/chat/completions`)를 제공한다. SSE 스트리밍 프록시를 통해 토큰 단위 실시간 응답을 지원한다.

## User & Purpose
- **Actor(s)**: 클라이언트 애플리케이션 개발자, AI 서비스 소비자
- **Problem**: 여러 LLM 프로바이더를 직접 통합하면 각각의 SDK, 인증, 응답 형식을 관리해야 하는 복잡성 발생
- **Key Scenarios**: OpenAI SDK 호환 클라이언트로 Anthropic 모델 호출, SSE 스트리밍으로 실시간 채팅 응답 수신, 프로바이더 변경 시 클라이언트 코드 무변경

## Capabilities
- Provider 추상화 인터페이스 (`ProviderAdapter` 패턴)
- OpenAI SDK 호환 `POST /v1/chat/completions` 엔드포인트
- SSE 스트리밍 프록시 (token-by-token forwarding)
- 모델 매핑 (클라이언트 요청 모델명 → 프로바이더별 실제 모델)
- 요청/응답 형식 변환 (OpenAI format ↔ Anthropic format)
- 스트리밍 중 에러 핸들링 (mid-stream error recovery)
- 토큰 카운팅 (청크별 실시간 + 프로바이더 최종 usage 기준 보정)

## Data Ownership
- **Owns**: Provider (프로바이더 설정), Model (모델 설정), GatewayRequest (요청 처리 컨텍스트)
- **References**: AppConfig (F001)

## Interfaces
- **Provides**: `POST /v1/chat/completions` (통합 LLM API), `ProviderRouter` 내부 서비스, `TokenCounter` 유틸리티
- **Consumes**: F001 ConfigModule, DatabaseModule, RedisModule

## Dependencies
- F001 Foundation Setup

## Domain-Specific Notes
- **ai-gateway A1 Streaming-First**: SSE가 기본 전달 모드. 버퍼링 없이 진정한 스트리밍 프록시 구현 (TTFT 최소화)
- **ai-gateway A1 Provider Abstraction**: 비즈니스 로직이 프로바이더 SDK를 직접 호출하지 않음. 새 프로바이더 추가 시 설정만으로 가능
- **AG-002 Streaming Token Count Mismatch**: 스트리밍 중 에러 시 실제 전달된 토큰 vs 과금된 토큰 보정 필수
- **AG-005 Fallback Infinite Loop**: 요청당 최대 재시도 깊이 제한, 비순환 폴백 체인

## For /speckit.specify
- SC 필수: 스트리밍 라이프사이클 (initiation → chunk forwarding → error mid-stream → termination)
- SC 필수: 프로바이더 라우팅 기준 (모델명 기반 매핑)
- SC 필수: OpenAI ↔ Anthropic 요청/응답 변환 규칙
- 프로바이더 응답의 `usage` 필드를 ground truth로 사용 (TB-003)
- 스트리밍 backpressure 처리 방식 결정 필요
- 에러 응답 형식은 OpenAI 에러 형식 호환으로 통일
