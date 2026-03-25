# Pre-Context: F005 — Request Logging & Tracing

## Feature Summary
모든 LLM 요청의 입출력, 토큰 수, 비용, 레이턴시를 로깅하고 테넌트/사용자별 비용 귀속을 추적한다. Langfuse 통합과 OpenTelemetry 기반 분산 트레이싱을 제공한다.

## User & Purpose
- **Actor(s)**: 플랫폼 운영자, 조직 관리자, 개발자
- **Problem**: LLM 사용 패턴 분석, 비용 귀속, 장애 진단을 위한 상세 로깅과 트레이싱이 없으면 운영 가시성 확보 불가
- **Key Scenarios**: 특정 요청의 전체 라이프사이클 추적 (요청→프로바이더→응답→과금), 일/주/월별 비용 리포트 생성, Langfuse 대시보드에서 LLM 품질 분석

## Capabilities
- 모든 LLM 요청 로깅 (input prompt, output response, model, tokens, cost, latency)
- 테넌트/팀/사용자별 비용 귀속 (cost attribution)
- Langfuse 통합 (LLM observability)
- OpenTelemetry 트레이스 전파 (trace ID, span ID)
- 요청 로그 검색/필터 API
- 민감 데이터 마스킹 후 로깅 (PII redaction in logs)
- 로그 보관 정책 (retention period 설정)

## Data Ownership
- **Owns**: RequestLog (요청 로그 엔티티)
- **References**: Provider, Model (F002), Organization, Team, User (F003)

## Interfaces
- **Provides**: `GET /logs` (로그 조회/검색), `GET /logs/:id` (단건 상세), `GET /analytics/usage` (사용량 분석), RequestLogger 인터셉터
- **Consumes**: F001 DatabaseModule, F002 GatewayRequest 컨텍스트, F003 TenantContext

## Dependencies
- F001 Foundation Setup
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- **ai-gateway A1 Audit Everything**: 모든 LLM 인터랙션을 풀 컨텍스트로 로깅 (테넌트, 사용자, 모델, 입출력, 토큰, 비용, 레이턴시, 가드레일 결정)
- **ai-gateway A4 Audit Capture**: 로깅 대상 필드, 민감 콘텐츠(PII) 처리 방식, 보관 정책 명시
- **PG-001 Mask-then-Log Ordering**: PII 감지 → 마스킹 → 마스킹된 버전만 로깅. 원본은 표준 로그에 절대 기록 금지.

## For /speckit.specify
- SC 필수: 로깅 대상 필드 목록 (request_id, tenant_id, user_id, model, input, output, input_tokens, output_tokens, cost, latency_ms, status)
- SC 필수: PII가 포함된 프롬프트/응답의 마스킹 후 로깅 (F006 연동 전에는 원본 저장, F006 이후 마스킹 적용)
- SC 필수: Langfuse trace 생성 시점과 span 구조 (gateway → provider → response)
- 로그 불변성 보장 (append-only, 수정/삭제 불가)
- 로그 보관 기간 설정 (기본 90일, 테넌트별 커스텀)
- 대용량 로그 처리: 비동기 쓰기 (BullMQ 큐) 고려
