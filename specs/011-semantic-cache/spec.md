# Feature Specification: F011 — Semantic Cache

**Feature Branch**: `011-semantic-cache`
**Created**: 2026-03-27
**Status**: Draft
**Input**: pgvector 코사인 유사도 기반 시맨틱 캐시, 히트율 모니터링, 테넌트별 캐시 정책

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 시맨틱 캐시 히트 (Priority: P1)

LLM 게이트웨이로 들어오는 요청의 쿼리가 이전에 캐시된 쿼리와 의미적으로 유사하면(코사인 유사도 ≥ threshold), LLM API를 호출하지 않고 캐시된 응답을 즉시 반환한다. 비용과 레이턴시를 크게 절감할 수 있다.

**Why this priority**: 시맨틱 캐시의 핵심 가치. 캐시 히트가 동작하지 않으면 Feature 전체가 무의미.

**Independent Test**: 동일한 질문을 두 번 전송. 첫 번째는 LLM 호출, 두 번째는 캐시 응답 반환 확인.

**Acceptance Scenarios**:

1. **Given** 캐시 정책 활성화(enabled=true, threshold=0.95), **When** 첫 번째 LLM 요청 전송, **Then** LLM 호출 → 응답 반환 + 캐시 저장 (query_vector + response).
2. **Given** 이전 요청과 유사한 쿼리(유사도 ≥ 0.95), **When** 두 번째 요청 전송, **Then** LLM 미호출 + 캐시 응답 반환 + `X-Cache: HIT` 헤더 + tokens_saved 기록.
3. **Given** 유사도 < threshold인 쿼리, **When** 요청 전송, **Then** LLM 호출 + `X-Cache: MISS` 헤더 + 새 캐시 엔트리 저장.
4. **Given** 캐시 히트, **When** 응답 반환, **Then** 원본 LLM 응답과 동일한 형식 (`choices[0].message` 구조 보존).

---

### User Story 2 — 테넌트별 캐시 정책 관리 (Priority: P1)

조직 관리자가 자신의 조직에 맞는 캐시 정책을 설정한다. 유사도 임계치, TTL, 캐시 활성화 여부를 조절하여 비용 절감과 응답 정확도 사이의 균형을 맞춘다.

**Why this priority**: 테넌트 격리는 엔터프라이즈 필수 요건. 정책 없이는 모든 조직이 동일 설정을 사용해야 함.

**Independent Test**: 캐시 정책 설정 → 정책에 따른 캐시 동작 확인.

**Acceptance Scenarios**:

1. **Given** admin 사용자, **When** `PUT /cache/policy/:orgId { similarity_threshold: 0.90, ttl_seconds: 3600, enabled: true }`, **Then** 200 + 정책 저장. 해당 org의 캐시는 0.90 threshold 적용.
2. **Given** 캐시 정책 미설정 org, **When** LLM 요청 전송, **Then** 기본 정책 적용 (threshold=0.95, ttl=86400, enabled=true).
3. **Given** enabled=false인 org, **When** LLM 요청 전송, **Then** 캐시 조회/저장 모두 스킵. 항상 LLM 직접 호출.
4. **Given** 타 org의 정책, **When** admin이 수정 시도, **Then** 404 (테넌트 격리).

---

### User Story 3 — 캐시 무효화 (Priority: P2)

관리자가 캐시를 수동으로 무효화하거나, TTL 만료 시 자동으로 캐시가 제거된다. 모델 변경 시에도 관련 캐시가 자동 무효화되어 stale 응답을 방지한다.

**Why this priority**: 캐시 관리 없이는 오래된 응답이 지속적으로 반환될 위험.

**Independent Test**: 캐시 생성 → TTL 만료/수동 삭제 → 동일 쿼리 → LLM 재호출 확인.

**Acceptance Scenarios**:

1. **Given** 캐시 엔트리 존재, **When** `DELETE /cache` (org 전체 무효화), **Then** 해당 org의 모든 캐시 삭제 + 200.
2. **Given** TTL=3600 캐시 엔트리, **When** 3600초 경과 후 유사 쿼리, **Then** 캐시 미스 → LLM 재호출.
3. **Given** model=gpt-4 캐시 엔트리 존재, **When** 동일 쿼리를 다른 모델(claude-3)로 요청, **Then** 캐시 미스 (모델별 캐시 분리).

---

### User Story 4 — 캐시 통계 조회 (Priority: P2)

관리자가 캐시 히트율, 절감된 토큰 수, 비용 절감 효과를 모니터링한다.

**Why this priority**: 운영 가시성. 캐시 효과를 수치로 확인하여 정책 튜닝에 활용.

**Independent Test**: 여러 요청 후 통계 API 호출 → 히트율/절감량 확인.

**Acceptance Scenarios**:

1. **Given** 10회 요청 중 7회 캐시 히트, **When** `GET /cache/stats`, **Then** `{ hit_count: 7, miss_count: 3, hit_rate: 0.7, total_tokens_saved: N, total_entries: M }`.
2. **Given** admin, **When** `GET /cache/stats?period=24h`, **Then** 최근 24시간 통계 반환.

---

### Edge Cases

- **빈 쿼리**: content가 빈 문자열이면 캐시 스킵 (임베딩 불가).
- **매우 긴 쿼리**: 100,000자 초과 쿼리는 캐시 스킵 (임베딩 비용 초과).
- **동시 동일 요청**: 같은 쿼리 동시 전송 시 첫 번째만 LLM 호출, 두 번째는 LLM 호출 후 캐시 저장 (race condition 허용 — 중복 저장 무해).
- **임베딩 서비스 장애**: 임베딩 생성 실패 시 캐시 스킵 → LLM 직접 호출 (fail-open).
- **캐시 DB 장애**: pgvector 조회 실패 시 캐시 스킵 → LLM 직접 호출 (fail-open).
- **스트리밍 응답**: 스트리밍 완료 후 전체 응답을 캐시 저장. 스트리밍 중에는 캐시 불가.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시맨틱 캐시 조회 — LLM 요청 수신 시 쿼리 임베딩 생성 → pgvector 코사인 유사도 검색 → threshold 이상이면 캐시 응답 반환
- **FR-002**: 캐시 저장 — LLM 응답 완료 후 쿼리 임베딩 + 응답 + 메타데이터(model, org_id) 캐시 저장. 스트리밍 완료 후 저장.
- **FR-003**: 테넌트별 캐시 정책 — org_id별 similarity_threshold, ttl_seconds, enabled 설정. 미설정 시 기본값 (0.95, 86400, true)
- **FR-004**: 캐시 무효화 — `DELETE /cache` org 전체 삭제. TTL 만료 자동 삭제.
- **FR-005**: 모델별 캐시 분리 — 캐시 키에 model 포함. 동일 쿼리라도 다른 모델이면 별도 캐시.
- **FR-006**: 캐시 통계 — hit_count, miss_count, hit_rate, total_tokens_saved, total_entries 제공
- **FR-007**: 캐시 히트 응답 포맷 — 원본 LLM 응답과 동일한 JSON 구조 반환. `X-Cache: HIT/MISS` 헤더 추가.
- **FR-008**: CacheInterceptor — F002 GatewayRequest 파이프라인에 NestJS Interceptor로 삽입. 캐시 히트 시 LLM 호출 스킵.
- **FR-009**: 테넌트 격리 — 모든 캐시 조회/저장에 org_id 필터. 타 org 캐시 접근 불가.
- **FR-010**: Fail-open — 임베딩 서비스/pgvector 장애 시 캐시 스킵, LLM 직접 호출 (서비스 가용성 우선)
- **FR-011**: 캐시 히트 시 F005 RequestLog에 cache_hit=true 기록
- **FR-012**: RBAC — admin/member는 정책 설정+무효화 가능, viewer는 통계 조회만 가능

### Key Entities

- **CacheEntry**: 캐시 항목. org_id, model, query_hash (SHA256), query_vector (pgvector), response (jsonb), tokens_saved, hit_count, ttl, created_at, expires_at
- **CachePolicy**: 테넌트별 캐시 정책. org_id (unique), similarity_threshold, ttl_seconds, enabled

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 동일 쿼리 두 번 전송 → 첫 번째: LLM 호출 + `X-Cache: MISS`, 두 번째: 캐시 응답 + `X-Cache: HIT` + LLM 미호출.
- **SC-002**: 캐시 히트 응답이 원본 LLM 응답과 동일한 JSON 구조 (`choices[0].message` 보존).
- **SC-003**: `PUT /cache/policy/:orgId { similarity_threshold: 0.90, ttl_seconds: 3600, enabled: true }` → 200 + 정책 저장 확인.
- **SC-004**: enabled=false org에서 LLM 요청 → 항상 LLM 직접 호출 (캐시 조회/저장 안 함).
- **SC-005**: `DELETE /cache` → 해당 org의 모든 캐시 삭제 + 200.
- **SC-006**: model=gpt-4 캐시 존재 시 동일 쿼리를 claude-3으로 요청 → 캐시 미스 (모델별 분리).
- **SC-007**: `GET /cache/stats` → hit_count, miss_count, hit_rate, total_tokens_saved, total_entries 반환.
- **SC-008**: 타 org의 캐시 정책 수정 시도 → 404 (테넌트 격리).
- **SC-009**: 임베딩 생성 실패 시 → 캐시 스킵 + LLM 직접 호출 + 정상 응답 (fail-open).
- **SC-010**: viewer 역할 `PUT /cache/policy` → 403. viewer `GET /cache/stats` → 200.
- **SC-011**: 캐시 히트 시 F005 RequestLog에 cache_hit=true 기록 확인.

## Assumptions

- 임베딩 생성은 OpenAI text-embedding-3-small 또는 호환 모델 사용. 임베딩 차원은 모델에 따라 결정.
- pgvector 확장은 F009(Knowledge Integration)에서 이미 설치됨. 별도 설치 불필요.
- 캐시 히트 판정은 요청 단위. 동일 사용자/세션 고려 없이 순수 쿼리 유사도만 비교.
- 스트리밍 응답 캐싱은 전체 청크 수집 완료 후 수행. 스트리밍 중단 시 캐시 저장하지 않음.
- 캐시 통계는 인메모리 카운터 + DB 집계 하이브리드. 실시간 정확도보다 대략적 추세 제공.
- F002 게이트웨이 파이프라인에 CacheInterceptor 삽입은 F011 scope. 기존 F002 코드 수정 최소화.
