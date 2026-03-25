# Pre-Context: F006 — Security Guardrails

## Feature Summary
LLM Guard 기반 입출력 스캐닝, PII 탐지/마스킹, 프롬프트 인젝션 방어, 테넌트별 보안 정책 오버라이드를 제공하는 보안 가드레일 파이프라인.

## User & Purpose
- **Actor(s)**: 보안 관리자, 조직 관리자, 컴플라이언스 담당자
- **Problem**: LLM 입출력에 PII 노출, 프롬프트 인젝션, 유해 콘텐츠 등 보안 위험이 존재. 테넌트별 보안 수준 차별화 필요.
- **Key Scenarios**: 사용자 입력에서 이메일/전화번호 자동 마스킹, 프롬프트 인젝션 시도 탐지 및 차단, 테넌트별 PII 카테고리 커스터마이징, LLM 응답에서 민감 정보 필터링

## Capabilities
- LLM Guard 기반 입력/출력 스캐닝 파이프라인
- PII 탐지: email, phone, SSN + 커스텀 패턴 (employee ID 등)
- PII 마스킹: `[EMAIL]`, `[PHONE]` 형태 플레이스홀더 치환
- 프롬프트 인젝션 방어: 휴리스틱 규칙 + ML 분류기
- 콘텐츠 필터링 (유해 콘텐츠 카테고리별 차단)
- 테넌트별 보안 정책 오버라이드 (PII 카테고리, 필터 수준 조정)
- 가드레일 결정 로깅 (어떤 스캐너가 어떤 판단을 했는지)

## Data Ownership
- **Owns**: SecurityPolicy (테넌트별 보안 정책), GuardResult (가드레일 판정 결과)
- **References**: Provider, GatewayRequest (F002), Organization (F003)

## Interfaces
- **Provides**: `GET /security-policies/:orgId`, `PUT /security-policies/:orgId`, GuardPipeline 미들웨어 (LLM 요청 파이프라인에 삽입)
- **Consumes**: F002 GatewayRequest 스트리밍 파이프라인, F003 TenantContext

## Dependencies
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- **PG-001 Mask-then-Log Ordering**: 감지 → 마스킹 → 마스킹된 버전 로깅. 원본은 표준 로그에 절대 기록 금지. 컴플라이언스 목적 원본 저장 시 암호화 별도 스토어.
- **PG-002 System Prompt Injection**: 시스템 프롬프트를 사용자 입력과 분리 (별도 API 파라미터). 인젝션 패턴 전용 스캐너.
- **PG-003 Partial PII in Streaming**: SSE 청크 경계에서 PII 분할 시 놓치는 버그 방지. 청크 경계에 버퍼 윈도우 유지.
- **PG-004 Encoding Bypass**: Base64, Unicode 호모글리프, HTML 엔티티 인코딩 우회 방지. 스캐닝 전 정규화 단계 필수.
- **PG-005 Output Filter Race Condition**: 스트리밍 출력 필터는 동기식 (필터 → 전송). 전송 후 필터링 금지.

## For /speckit.specify
- SC 필수: PII 탐지 대상 유형 (email, phone, SSN, name, address, custom), 탐지 방법 (regex, NER, ML), 탐지 시 행동 (mask, reject, warn)
- SC 필수: 출력 PII 스캐닝 — LLM 응답을 클라이언트 전달 전 스캔
- SC 필수: 프롬프트 인젝션 탐지 — 방법 (classifier + heuristic), 오탐 처리, 우회 조건
- SC 필수: 스트리밍 파이프라인에서 가드 실행 순서 (injection → PII → content)
- SC 필수: 특권 바이패스 — admin 역할의 가드레일 우회 조건, 우회 시 로깅 필수
- 가드레일 latency 목표: sub-100ms (인라인 파이프라인이므로)
