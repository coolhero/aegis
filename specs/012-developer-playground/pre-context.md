# Pre-Context: F012 — Developer Playground

## Feature Summary
모델 테스트 UI(실시간 스트리밍), 비용 추정(토큰 프리뷰), API 탐색기(Swagger-like), 프롬프트 에디터(템플릿 테스팅)를 제공하는 개발자 도구.

## User & Purpose
- **Actor(s)**: 개발자, 프롬프트 엔지니어
- **Problem**: LLM API 통합 전에 모델 동작 확인, 비용 추정, API 스펙 탐색, 프롬프트 실험을 위한 인터랙티브 환경이 필요
- **Key Scenarios**: 모델 선택 후 프롬프트 입력하여 실시간 스트리밍 응답 확인, 요청 전 토큰 수/비용 사전 추정, API 엔드포인트 탐색 및 테스트 호출, 프롬프트 템플릿 변수 치환 테스트

## Capabilities
- 모델 테스트 UI (모델 선택, 파라미터 조정, 실시간 SSE 스트리밍 응답)
- 비용 추정 (입력 토큰 카운팅 + 예상 출력 토큰 기반 비용 계산)
- API 탐색기 (Swagger/OpenAPI 기반 엔드포인트 문서 + 인터랙티브 호출)
- 프롬프트 에디터 (템플릿 변수 입력 폼, 렌더링 프리뷰, 히스토리)
- 요청/응답 히스토리 (세션 내 호출 이력)
- 모델 비교 (동일 프롬프트 멀티 모델 동시 호출)

## Data Ownership
- **Owns**: 없음 (프론트엔드 전용 — 세션 내 임시 데이터만 사용)
- **References**: Provider, Model (F002), Organization, User (F003), PromptTemplate (F010)

## Interfaces
- **Provides**: 웹 Playground UI (`/playground/*` 라우트)
- **Consumes**: F002 `/v1/chat/completions` API, F003 Auth API, F007 대시보드 레이아웃/컴포넌트 공유

## Dependencies
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy
- F007 Admin Dashboard (UI 프레임워크/레이아웃 공유)

## Domain-Specific Notes
- **ai-gateway A1 Streaming-First**: Playground의 핵심 UX는 실시간 토큰 스트리밍. SSE 연결 관리와 부분 응답 표시 필수.
- Playground 요청도 일반 LLM 요청과 동일하게 예산 차감, 로깅 적용 (playground 전용 예외 없음).
- API 탐색기는 OpenAPI/Swagger spec을 자동 생성하여 렌더링.

## For /speckit.specify
- SC 필수: 스트리밍 UI (SSE 연결 → 토큰별 렌더링 → 완료/에러 처리)
- SC 필수: 비용 추정 로직 (tiktoken 기반 입력 토큰 카운팅, max_tokens 기반 최대 비용 계산)
- SC 필수: API 탐색기 — OpenAPI spec 자동 생성 및 인터랙티브 호출 UI
- SC 필수: 프롬프트 에디터 — 템플릿 변수 폼 자동 생성, 렌더링 프리뷰
- Playground 요청도 예산 차감 대상 (F004 BudgetGuard 적용)
- 모델 비교 기능의 동시 호출 제한 (최대 3개 모델)
