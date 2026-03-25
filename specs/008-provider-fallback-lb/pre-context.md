# Pre-Context: F008 — Provider Fallback & Load Balancing

## Feature Summary
프로바이더 헬스체크, 자동 페일오버, 레이턴시 기반 라우팅, 가중 라운드로빈, 프로바이더별 서킷 브레이커를 제공한다. 최대 2-hop 폴백 제한(AG-001).

## User & Purpose
- **Actor(s)**: 플랫폼 운영자, SRE
- **Problem**: 단일 LLM 프로바이더 장애 시 서비스 전체 중단. 프로바이더 간 부하 분산과 자동 복구가 필요.
- **Key Scenarios**: OpenAI 장애 시 Anthropic 자동 전환, 레이턴시가 낮은 프로바이더 우선 라우팅, 프로바이더 복구 후 자동 트래픽 복원, 서킷 브레이커 OPEN 상태에서 주기적 헬스 프로브

## Capabilities
- 프로바이더 헬스체크 (주기적 프로브 + 요청 실패율 기반)
- 자동 페일오버 (primary → secondary, 최대 2-hop)
- 레이턴시 기반 라우팅 (최근 N분 평균 레이턴시)
- 가중 라운드로빈 (프로바이더별 가중치 설정)
- 서킷 브레이커 (CLOSED → OPEN → HALF-OPEN 상태 머신)
- 폴백 체인 비순환 보장 (AG-005)

## Data Ownership
- **Owns**: 없음 (F002 Provider 엔티티 확장 — 헬스 상태, 가중치, 서킷 상태 추가)
- **References**: Provider, Model (F002)

## Interfaces
- **Provides**: `GET /providers/health` (프로바이더 상태 조회), ProviderRouter 라우팅 로직 확장 (F002 내부 서비스 확장)
- **Consumes**: F002 Provider 설정, ProviderAdapter 인터페이스

## Dependencies
- F002 LLM Gateway Core

## Domain-Specific Notes
- **AG-001 Provider Cascade Failure**: 주 프로바이더 장애 → 모든 요청이 부 프로바이더로 쏠림 → 부 프로바이더도 장애. 프로바이더별 독립 서킷 브레이커, 지수 백오프, 요청당 최대 2-hop 폴백.
- **AG-005 Fallback Infinite Loop**: primary→secondary→primary... 무한 루프 방지. 폴백 체인 비순환. 체인 소진 후 503 + Retry-After 응답.
- **ai-gateway A3 Failover Strategy**: 자동 폴백, 서킷 브레이커, 폴백 상황을 클라이언트에 어떻게 전달하는지 명시.

## For /speckit.specify
- SC 필수: 서킷 브레이커 상태 전이 (failure threshold → OPEN, timeout → HALF-OPEN, success → CLOSED)
- SC 필수: 폴백 체인 정의 방식 (설정 기반, 모델별 매핑)
- SC 필수: 최대 2-hop 폴백 제한, 체인 소진 시 503 응답
- SC 필수: 헬스체크 프로브 주기, 실패 판정 기준 (연속 N회 실패, 에러율 M%)
- 레이턴시 기반 라우팅의 측정 윈도우와 가중치 계산 방식 결정 필요
- 폴백 발생 시 클라이언트 투명(transparent) vs 헤더로 알림 결정 필요
