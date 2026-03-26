# Tasks: Security Guardrails

**Feature**: F006 - Security Guardrails
**Date**: 2026-03-26
**Plan**: [plan.md](./plan.md)

## Task Overview

| Task | Description | Phase | Dependencies | Complexity |
|------|-------------|-------|-------------|------------|
| T001 | SecurityPolicy + GuardResult 엔티티 | 1 | — | Low |
| T002 | Scanner 인터페이스 + Normalizer | 1 | — | Low |
| T003 | PII Scanner | 1 | T002 | Medium |
| T004 | Injection Scanner | 1 | T002 | Medium |
| T005 | Content Scanner | 1 | T002 | Low |
| T006 | GuardPipeline Service | 1 | T001, T003, T004, T005 | Medium |
| T007 | SecurityGuard (NestJS Guard) | 2 | T004, T006 | Medium |
| T008 | GuardInterceptor (입력 PII + 출력 필터) | 2 | T003, T005, T006 | High |
| T009 | 스트리밍 출력 버퍼 필터 | 2 | T008 | High |
| T010 | SecurityPolicy Service (CRUD + Redis) | 3 | T001 | Medium |
| T011 | SecurityPolicy Controller (API) | 3 | T010 | Low |
| T012 | 바이패스 로직 | 3 | T007 | Low |
| T013 | F002 파이프라인 통합 + Module 등록 | 2 | T007, T008 | Medium |
| T014 | F005 mask-then-log 연동 | 4 | T008 | Low |
| T015 | 통합 테스트 | 4 | T013, T014 | Medium |
| T016 | 데모 스크립트 | 4 | T015 | Low |

---

## T001: SecurityPolicy + GuardResult 엔티티

**Phase**: 1
**Dependencies**: None
**Files**:
- `apps/api/src/security/entities/security-policy.entity.ts`
- `apps/api/src/security/entities/guard-result.entity.ts`
- `apps/api/src/security/dto/update-security-policy.dto.ts`
- `apps/api/src/security/dto/security-policy-response.dto.ts`

**Tasks**:
1. SecurityPolicy TypeORM 엔티티 생성 (data-model.md 기반)
   - org_id UNIQUE 제약
   - pii_categories, content_filter_categories, bypass_roles, custom_pii_patterns → JSONB
   - pii_action → VARCHAR ENUM
   - 기본값 설정
2. GuardResult TypeORM 엔티티 생성
   - request_id, scanner_type, decision 인덱스
   - details → JSONB
3. DTO 클래스 생성 (class-validator 데코레이터)
4. 단위 테스트: 엔티티 생성, 기본값 검증

**SC Coverage**: SC-007 (정책 조회), SC-015 (기본 정책)

---

## T002: Scanner 인터페이스 + Normalizer

**Phase**: 1
**Dependencies**: None
**Files**:
- `apps/api/src/security/scanners/scanner.interface.ts`
- `apps/api/src/security/scanners/normalizer.ts`
- `apps/api/src/security/__tests__/normalizer.spec.ts`

**Tasks**:
1. Scanner 인터페이스 정의: `scan(input, policy) → ScanResult`
2. ScanResult 타입: `{ decision, transformed?, details, latency_ms }`
3. ScannerType enum: `pii | injection | content`
4. Normalizer 구현:
   - Base64 감지 + 디코딩
   - Unicode NFKC 정규화
   - HTML 엔티티 디코딩
5. Normalizer 단위 테스트 (10+ 케이스)

**SC Coverage**: SC-005 (Base64 인코딩 탐지)

---

## T003: PII Scanner

**Phase**: 1
**Dependencies**: T002
**Files**:
- `apps/api/src/security/scanners/pii.scanner.ts`
- `apps/api/src/security/__tests__/pii.scanner.spec.ts`

**Tasks**:
1. PII 패턴 정의: email, phone, ssn, name, address
   - email: RFC 5322 간소화 regex
   - phone: 한국(010-XXXX-XXXX), 국제(+XX-XXX...) 패턴
   - ssn: 한국 주민등록번호 패턴 (YYMMDD-NNNNNNN)
2. 마스킹 로직: 감지된 PII → `[EMAIL]`, `[PHONE]`, `[SSN]`, `[NAME]`, `[ADDRESS]` 치환
3. 커스텀 패턴 지원: SecurityPolicy.custom_pii_patterns에서 동적 로딩
4. pii_action 분기: mask → 치환, reject → block, warn → pass + 경고
5. 단위 테스트: 각 PII 유형별 감지/마스킹 + 엣지 케이스 (15+ 케이스)

**SC Coverage**: SC-001 (email), SC-002 (phone), SC-003 (ssn)

---

## T004: Injection Scanner

**Phase**: 1
**Dependencies**: T002
**Files**:
- `apps/api/src/security/scanners/injection.scanner.ts`
- `apps/api/src/security/scanners/injection-patterns.ts`
- `apps/api/src/security/__tests__/injection.scanner.spec.ts`

**Tasks**:
1. 인젝션 패턴 DB 정의 (injection-patterns.ts):
   - "ignore previous instructions"
   - "reveal system prompt"
   - "disregard above"
   - "you are now [role]"
   - OWASP LLM Top 10 기반 추가 패턴 (20+ 패턴)
2. 대소문자 무시 + 정규화된 입력 대상 매칭
3. false positive 방지: "ignore the noise" 같은 일반 표현 허용 리스트
4. 단위 테스트: 알려진 인젝션 + false positive 케이스 (15+ 케이스)

**SC Coverage**: SC-004 (직접 인젝션), SC-005 (인코딩 인젝션), SC-006 (false positive)

---

## T005: Content Scanner

**Phase**: 1
**Dependencies**: T002
**Files**:
- `apps/api/src/security/scanners/content.scanner.ts`
- `apps/api/src/security/__tests__/content.scanner.spec.ts`

**Tasks**:
1. 콘텐츠 카테고리별 키워드/패턴 정의: hate_speech, violence, self_harm, illegal
2. 심각도 수준 판정: low/medium/high
3. 정책의 content_filter_categories에 없는 카테고리는 스킵
4. 단위 테스트: 각 카테고리별 감지 + 비감지 케이스

**SC Coverage**: US4-AS3 (콘텐츠 필터링)

---

## T006: GuardPipeline Service

**Phase**: 1
**Dependencies**: T001, T003, T004, T005
**Files**:
- `apps/api/src/security/guard-pipeline.service.ts`
- `apps/api/src/security/__tests__/guard-pipeline.service.spec.ts`

**Tasks**:
1. 스캐너 실행 오케스트레이션: injection → PII → content 순서 (FR-001)
2. Normalizer 호출 → 정규화된 입력으로 스캐닝
3. 각 스캐너 결과를 GuardResult에 저장
4. 첫 block 결과에서 즉시 중단 (short-circuit)
5. 전체 latency 측정 + 기록
6. 스캐너 오류 시 fail-closed (FR-015)
7. 바이패스 체크 로직 (role + header)
8. 단위 테스트: 파이프라인 순서, short-circuit, fail-closed

**SC Coverage**: SC-013 (fail-closed), SC-014 (latency)

---

## T007: SecurityGuard (NestJS Guard)

**Phase**: 2
**Dependencies**: T004, T006
**Files**:
- `apps/api/src/security/security.guard.ts`
- `apps/api/src/security/__tests__/security.guard.spec.ts`

**Tasks**:
1. NestJS CanActivate 구현
2. 요청에서 messages 추출 → user 메시지만 스캔
3. TenantContext에서 org_id 가져오기 → SecurityPolicy 로딩
4. 바이패스 체크: bypass_roles + X-Guard-Bypass 헤더
5. injection_defense_enabled=false 시 스킵
6. Injection Scanner 호출 → block이면 ForbiddenException (403)
7. 단위 테스트: 인젝션 차단, 바이패스, 비활성화

**SC Coverage**: SC-004 (인젝션 차단), SC-012 (바이패스)

---

## T008: GuardInterceptor (입력 PII + 출력 필터)

**Phase**: 2
**Dependencies**: T003, T005, T006
**Files**:
- `apps/api/src/security/guard.interceptor.ts`
- `apps/api/src/security/__tests__/guard.interceptor.spec.ts`

**Tasks**:
1. NestJS Interceptor 구현 (intercept 메서드)
2. **Before**: 요청 body에서 messages 추출 → PII Scanner로 마스킹 → body 교체
3. **After (non-streaming)**: 응답 body에서 content 추출 → PII + Content Scanner → 마스킹
4. **After (streaming)**: SSE Observable에 pipe → 스트리밍 필터 적용 (T009)
5. 마스킹된 입력을 request에 첨부 (RequestLogger가 참조)
6. GuardResult 저장 (입력/출력 각각)
7. 단위 테스트: 입력 마스킹, 출력 마스킹, 스트리밍 분기

**SC Coverage**: SC-001~003 (입력 PII), SC-010 (출력 PII), SC-016 (mask-then-log)

---

## T009: 스트리밍 출력 버퍼 필터

**Phase**: 2
**Dependencies**: T008
**Files**:
- `apps/api/src/security/streaming-filter.ts`
- `apps/api/src/security/__tests__/streaming-filter.spec.ts`

**Tasks**:
1. SSE 청크 버퍼 관리 (최근 50자 유지)
2. 청크 수신 → 버퍼에 추가 → PII 패턴 스캔
3. PII 미감지 영역만 flush, 잔여 버퍼 유지
4. 스트림 종료(data: [DONE]) 시 잔여 버퍼 전체 flush
5. PG-003 방지: 청크 경계 PII 재조합 마스킹
6. PG-005 방지: 필터→전송 동기식 보장
7. 단위 테스트: 경계 PII 분할, 정상 통과, 스트림 종료

**SC Coverage**: SC-011 (스트리밍 PII 경계)

---

## T010: SecurityPolicy Service (CRUD + Redis)

**Phase**: 3
**Dependencies**: T001
**Files**:
- `apps/api/src/security/security-policy.service.ts`
- `apps/api/src/security/__tests__/security-policy.service.spec.ts`

**Tasks**:
1. getPolicy(orgId): Redis 캐시 확인 → miss 시 DB → miss 시 기본 정책
2. updatePolicy(orgId, dto): DB upsert → Redis 무효화
3. Redis 키: `security-policy:{org_id}`, TTL 300초
4. 기본 정책 상수 정의
5. custom_pii_patterns 유효성 검사 (regex 컴파일 테스트)
6. 단위 테스트: CRUD, 캐싱, 기본 정책

**SC Coverage**: SC-007 (조회), SC-008 (수정 반영), SC-015 (기본 정책)

---

## T011: SecurityPolicy Controller (API)

**Phase**: 3
**Dependencies**: T010
**Files**:
- `apps/api/src/security/security-policy.controller.ts`
- `apps/api/src/security/__tests__/security-policy.controller.spec.ts`

**Tasks**:
1. GET /security-policies/:orgId — @Roles('admin', 'member', 'viewer') + TenantContext 검증
2. PUT /security-policies/:orgId — @Roles('admin') only
3. DTO 유효성 검사 (class-validator)
4. 잘못된 regex 패턴 → 400 Bad Request
5. 단위 테스트: 권한 체크, CRUD, 유효성 검증

**SC Coverage**: SC-007 (GET), SC-008 (PUT), SC-009 (403)

---

## T012: 바이패스 로직

**Phase**: 3
**Dependencies**: T007
**Files**:
- T007(security.guard.ts)에 통합
- T006(guard-pipeline.service.ts)에 통합

**Tasks**:
1. X-Guard-Bypass 헤더 감지
2. 요청자 role이 policy.bypass_roles에 포함되는지 확인
3. 바이패스 시: 모든 스캐너 스킵, GuardResult에 decision=bypass 기록
4. 바이패스 불가 시: 헤더 무시, 정상 스캐닝
5. 단위 테스트: 바이패스 성공/실패

**SC Coverage**: SC-012 (바이패스)

---

## T013: F002 파이프라인 통합 + Module 등록

**Phase**: 2
**Dependencies**: T007, T008
**Files**:
- `apps/api/src/security/security.module.ts`
- `apps/api/src/gateway/gateway.module.ts` (수정)
- `apps/api/src/app.module.ts` (수정)

**Tasks**:
1. SecurityModule 정의: providers, controllers, exports
2. SecurityModule을 AppModule에 imports
3. SecurityGuard를 gateway 라우트에 적용 (@UseGuards)
4. GuardInterceptor를 gateway 라우트에 적용 (@UseInterceptors)
5. 통합 확인: LLM 요청 시 Guard → Interceptor → LLM → Interceptor 순서

**SC Coverage**: SC-001~006, SC-010~012

---

## T014: F005 mask-then-log 연동

**Phase**: 4
**Dependencies**: T008
**Files**:
- `apps/api/src/security/guard.interceptor.ts` (수정)
- `apps/api/src/logging/request-logger.interceptor.ts` (수정)

**Tasks**:
1. GuardInterceptor가 마스킹된 입력을 request 객체에 첨부
2. RequestLogger가 request에서 마스킹된 버전 읽어 input_masked에 저장
3. 원본 content가 RequestLog에 기록되지 않음 검증
4. 테스트: PII 포함 요청 → RequestLog의 input_masked에 원본 미포함

**SC Coverage**: SC-016 (mask-then-log)

---

## T015: 통합 테스트

**Phase**: 4
**Dependencies**: T013, T014
**Files**:
- `apps/api/src/security/__tests__/security.integration.spec.ts`

**Tasks**:
1. E2E 테스트: 인증 → PII 포함 요청 → 마스킹 확인 → GuardResult 확인
2. E2E 테스트: 인젝션 요청 → 403 차단 확인
3. E2E 테스트: 정책 수정 → 이후 요청 반영 확인
4. E2E 테스트: 바이패스 → GuardResult bypass 확인
5. E2E 테스트: 스트리밍 출력 PII 마스킹
6. 빌드 확인: npm run build 성공

**SC Coverage**: SC-001~017 (전체)

---

## T016: 데모 스크립트

**Phase**: 4
**Dependencies**: T015
**Files**:
- `demos/F006-security-guardrails.sh`

**Tasks**:
1. 서버 시작 + 헬스체크 대기
2. 기본 모드: PII 마스킹, 인젝션 차단, 정책 관리, 바이패스 시연 → URL/명령 출력 → 실행 유지
3. --ci 모드: 자동 curl 테스트 → 결과 출력 → 종료
4. 실행 확인

**SC Coverage**: Demo-Ready Delivery
