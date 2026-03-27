# Tasks: F011 — Semantic Cache

**Input**: Design documents from `/specs/011-semantic-cache/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/cache-api.md

## Phase 1: Setup (모듈 + 엔티티)

- [ ] **T001** [US1] NestJS CacheModule 생성 + 2개 TypeORM 엔티티 정의
  - `apps/api/src/cache/cache.module.ts`
  - `apps/api/src/cache/cache-entry.entity.ts` (CacheEntry — pgvector column)
  - `apps/api/src/cache/cache-policy.entity.ts` (CachePolicy)
  - AppModule에 CacheModule import
  - DB sync → 테이블 생성 확인 + pgvector 인덱스
  - **Micro-Verify**: `npm run build` 성공

## Phase 2: 임베딩 서비스 (P1)

- [ ] **T002** [P] [US1] EmbeddingService 구현
  - `apps/api/src/cache/embedding.service.ts`
  - `embed(text)` — OpenAI text-embedding-3-small 호출 → float[] 반환
  - 실패 시 null 반환 (fail-open)
  - **Micro-Verify**: 단위 테스트 — 정상 호출 + 실패 시 null

## Phase 3: 캐시 핵심 서비스 (P1)

- [ ] **T003** [US1] CacheService 구현 — 캐시 조회/저장/무효화
  - `apps/api/src/cache/cache.service.ts`
  - `findSimilar(orgId, model, embedding, threshold)` — pgvector 코사인 유사도 검색
  - `store(orgId, model, queryHash, embedding, response, ttl, tokensSaved)` — 캐시 저장
  - `invalidateOrg(orgId)` — org 전체 캐시 삭제
  - `recordHit(entryId)` — hit_count 증가
  - **Micro-Verify**: 단위 테스트 — 조회(히트/미스) + 저장 + 무효화

## Phase 4: 테넌트 정책 (P1)

- [ ] **T004** [US2] CachePolicyService + DTO 구현
  - `apps/api/src/cache/cache-policy.service.ts`
  - `apps/api/src/cache/dto/update-cache-policy.dto.ts`
  - `getPolicy(orgId)` — 정책 조회. 미설정 시 기본값 반환
  - `updatePolicy(orgId, dto)` — 정책 생성/수정
  - **Micro-Verify**: 단위 테스트 — 정책 조회(기본값) + 수정 + 재조회

## Phase 5: CacheInterceptor (P1)

- [ ] **T005** [US1] CacheInterceptor 구현
  - `apps/api/src/cache/cache.interceptor.ts`
  - NestJS Interceptor: 요청 전 캐시 조회, 히트 → 응답 반환, 미스 → LLM 호출 후 저장
  - X-Cache 헤더 (HIT/MISS) 설정
  - fail-open: 임베딩/DB 장애 시 스킵
  - **Micro-Verify**: 단위 테스트 — 히트/미스 시나리오 + fail-open

- [ ] **T006** [US1] CacheInterceptor를 F002 GatewayController에 적용
  - F002 `gateway.controller.ts`에 `@UseInterceptors(CacheInterceptor)` 추가
  - 스트리밍 응답: 전체 청크 수집 후 캐시 저장
  - **Micro-Verify**: `npm run build` 성공 + 기존 F002 테스트 통과

## Phase 6: Controller + 통계 (P2)

- [ ] **T007** [US3,4] CacheController + CacheStatsService 구현
  - `apps/api/src/cache/cache.controller.ts`
  - `apps/api/src/cache/cache-stats.service.ts`
  - `apps/api/src/cache/dto/cache-stats-query.dto.ts`
  - `GET /cache/stats` — 히트율, 절감 토큰, 엔트리 수
  - `DELETE /cache` — org 전체 캐시 무효화
  - `PUT /cache/policy/:orgId` — 정책 수정
  - `GET /cache/policy/:orgId` — 정책 조회
  - AuthGuard + TenantContext + RBAC 적용
  - **Micro-Verify**: `curl GET /cache/stats`, `curl DELETE /cache`, `curl PUT /cache/policy`

## Phase 7: RBAC + Edge Cases + 테스트

- [ ] **T008** [US1-4] RBAC 검증 + Edge Cases
  - viewer: DELETE /cache → 403, PUT /policy → 403, GET /stats → 200
  - 타 org 정책 수정 → 404
  - enabled=false → 캐시 스킵
  - 빈 쿼리 → 캐시 스킵
  - cache_hit 플래그 F005 RequestLog 연동
  - **Micro-Verify**: 각 edge case 단위 테스트

## Phase 8: Demo Script

- [ ] **T009** [ALL] 데모 스크립트 작성
  - `demos/F011-semantic-cache.sh`
  - 기본 모드: 서버 시작 → "Try it" 안내 → 대기
  - `--ci` 모드: 빌드+테스트 → 헬스체크 → 종료

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 1 Setup | T001 | - |
| 2 Embedding | T002 [P] | T001 |
| 3 Cache Core | T003 | T001 |
| 4 Policy | T004 | T001 |
| 5 Interceptor | T005, T006 | T002, T003, T004 |
| 6 Controller | T007 | T003, T004 |
| 7 RBAC+Edge | T008 | T001-T007 |
| 8 Demo | T009 | T001-T008 |

**병렬 가능**: T002 (Embedding), T003 (CacheService), T004 (Policy)는 T001 이후 독립 개발 가능
**총 태스크**: 9개
