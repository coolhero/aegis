# Pre-Context: F010 — Prompt Management

## Feature Summary
Git 스타일 프롬프트 버전 관리, 변수 치환 템플릿 시스템, 트래픽 분할 기반 A/B 테스팅을 제공하는 프롬프트 관리 플랫폼.

## User & Purpose
- **Actor(s)**: 프롬프트 엔지니어, 개발자, 팀 리더
- **Problem**: 프롬프트를 코드에 하드코딩하면 버전 관리, 롤백, 실험이 어려움. 체계적인 프롬프트 라이프사이클 관리가 필요.
- **Key Scenarios**: 프롬프트 새 버전 배포 후 문제 시 이전 버전 롤백, 변수 템플릿으로 동적 프롬프트 생성, A/B 테스트로 프롬프트 변형 간 성능 비교

## Capabilities
- Git 스타일 프롬프트 버전 관리 (create, update, version history, rollback)
- 변수 치환 템플릿 시스템 (`{{variable}}` 패턴)
- A/B 테스팅 (트래픽 분할 비율 설정, 변형별 성과 추적)
- 프롬프트 라이브러리 (재사용 가능한 프롬프트 저장소)
- 활성 버전 지정 (draft → published → archived)
- 프롬프트 사용 통계 (어떤 프롬프트가 얼마나 호출되었는지)

## Data Ownership
- **Owns**: PromptTemplate (프롬프트 템플릿), PromptVersion (버전 이력)
- **References**: Organization, Team (F003), GatewayRequest (F002)

## Interfaces
- **Provides**: `POST /prompts` (생성), `GET /prompts` (목록), `GET /prompts/:id/versions` (버전 이력), `POST /prompts/:id/publish` (배포), `POST /prompts/:id/rollback` (롤백), `POST /prompts/:id/ab-test` (A/B 테스트 설정)
- **Consumes**: F002 GatewayRequest 파이프라인 (프롬프트 주입), F003 TenantContext

## Dependencies
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- A/B 테스트 트래픽 분할은 요청 단위 결정. 동일 사용자가 다른 세션에서 다른 변형을 받을 수 있음 (stateless split).
- 프롬프트 버전 롤백 시 현재 활성 A/B 테스트 자동 종료 여부 결정 필요.
- 프롬프트 템플릿의 변수 검증 (필수 변수 누락 시 에러).

## For /speckit.specify
- SC 필수: 버전 관리 라이프사이클 (draft → published → archived), 롤백 메커니즘
- SC 필수: 변수 치환 규칙 (`{{var}}` 패턴, 미치환 변수 에러 처리, 기본값 지원)
- SC 필수: A/B 테스트 설정 (변형 정의, 트래픽 분할 비율, 성과 메트릭, 종료 조건)
- SC 필수: 프롬프트 해결(resolution) — 요청 시 어떤 프롬프트 버전이 사용되는지 결정 로직
- 테넌트별 프롬프트 격리 (타 테넌트 프롬프트 접근 불가)
- 프롬프트 크기 제한 (최대 토큰 수) 결정 필요
