# Pre-Context: F011 — Semantic Cache

## Feature Summary
pgvector 코사인 유사도 기반 유사 쿼리 캐싱, 캐시 히트율 모니터링, 테넌트별 캐시 정책을 통해 30-50% 비용 절감을 목표로 한다.

## User & Purpose
- **Actor(s)**: 플랫폼 운영자 (비용 최적화), 조직 관리자 (캐시 정책 설정)
- **Problem**: 유사한 질문이 반복되면 매번 LLM API를 호출하여 불필요한 비용과 레이턴시 발생
- **Key Scenarios**: 유사 질문 캐시 히트 시 즉시 응답 (LLM 호출 없이), 캐시 히트율 대시보드 모니터링, 테넌트별 캐시 TTL/유사도 임계치 커스터마이징, 민감 데이터 캐시 제외

## Capabilities
- pgvector 코사인 유사도 기반 시맨틱 캐시
- 유사도 임계치 설정 (기본 0.95, 테넌트별 조정 가능)
- 캐시 히트율 모니터링 및 통계
- 테넌트별 캐시 정책 (TTL, 유사도 임계치, 캐시 활성화 여부)
- 캐시 무효화 (수동 + TTL 기반)
- 모델/프롬프트 변경 시 관련 캐시 자동 무효화
- 민감 쿼리 캐시 제외 (가드레일 연동)

## Data Ownership
- **Owns**: CacheEntry (캐시 항목 — 쿼리 임베딩, 응답, 메타데이터)
- **References**: Provider, Model (F002), Organization (F003)

## Interfaces
- **Provides**: `GET /cache/stats` (캐시 통계), `DELETE /cache` (캐시 무효화), `PUT /cache/policy/:orgId` (정책 설정), CacheInterceptor (LLM 요청 파이프라인에 삽입)
- **Consumes**: F002 GatewayRequest 파이프라인, F003 TenantContext

## Dependencies
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- **AG-003 Tenant Isolation Bypass**: 캐시 키에 반드시 tenant_id 포함. 테넌트 간 캐시 공유 절대 불가.
- pgvector 인덱스 성능: IVFFlat 또는 HNSW 인덱스 선택. 캐시 엔트리 수에 따른 인덱스 전략.
- 스트리밍 응답 캐싱: 전체 응답 완료 후 캐시 저장 (스트리밍 중에는 캐시 불가).
- 캐시 히트 시에도 F005 RequestLog에 기록 (cache_hit 플래그 포함).

## For /speckit.specify
- SC 필수: 캐시 조회 플로우 (쿼리 임베딩 → 유사도 검색 → threshold 비교 → 히트/미스)
- SC 필수: 캐시 저장 플로우 (LLM 응답 완료 → 응답+메타데이터 캐시 저장)
- SC 필수: 테넌트별 캐시 정책 (TTL, similarity_threshold, enabled)
- SC 필수: 캐시 무효화 조건 (TTL 만료, 수동 삭제, 모델 변경)
- 30-50% 비용 절감 목표 달성을 위한 유사도 임계치 튜닝 전략
- 캐시 히트 시 응답 포맷 (원본 LLM 응답과 동일한 형식)
