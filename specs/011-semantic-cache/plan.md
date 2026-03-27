# Implementation Plan: F011 — Semantic Cache

**Branch**: `011-semantic-cache` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)

## Summary

pgvector 코사인 유사도 기반 시맨틱 캐시를 NestJS 백엔드에 추가한다. CacheInterceptor를 F002 GatewayRequest 파이프라인에 삽입하여 유사 쿼리를 캐시하고, 테넌트별 캐시 정책 관리와 통계 API를 제공한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, pgvector, OpenAI (임베딩)
**Storage**: PostgreSQL (pgvector — 캐시 벡터 검색), Redis (캐시 통계 카운터)
**Testing**: Jest + Supertest
**Project Type**: Backend service module (`apps/api/src/cache/`)
**Performance Goals**: 캐시 조회 < 50ms, 임베딩 생성 < 200ms
**Constraints**: F009에서 pgvector 확장 이미 설치됨. 임베딩 모델은 OpenAI text-embedding-3-small 사용.

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| Tenant Data Isolation | ✅ 모든 캐시 조회/저장에 org_id 필터. CachePolicy도 org_id 기반 |
| Start Simple (YAGNI) | ✅ 단순 코사인 유사도. 복합 캐시 전략(LRU, 용량 기반) 미구현 |
| Fail-Open | ✅ 임베딩/pgvector 장애 시 캐시 스킵 → LLM 직접 호출 |
| Audit Trail | ✅ cache_hit 플래그 F005 RequestLog에 기록 |

## Project Structure

```text
apps/api/src/cache/
├── cache.module.ts               # NestJS 모듈
├── cache-entry.entity.ts         # CacheEntry TypeORM 엔티티 (pgvector)
├── cache-policy.entity.ts        # CachePolicy TypeORM 엔티티
├── cache.service.ts              # 캐시 조회/저장/무효화 로직
├── cache-policy.service.ts       # 테넌트별 정책 CRUD
├── cache-stats.service.ts        # 통계 집계
├── embedding.service.ts          # 임베딩 생성 (OpenAI API)
├── cache.interceptor.ts          # NestJS Interceptor (F002 파이프라인 삽입)
├── cache.controller.ts           # 통계/무효화/정책 API
├── dto/
│   ├── update-cache-policy.dto.ts
│   └── cache-stats-query.dto.ts
└── __tests__/
    ├── cache.service.spec.ts
    ├── embedding.service.spec.ts
    └── cache.interceptor.spec.ts
```

## Architecture

### 캐시 조회 플로우 (CacheInterceptor)

```
Request → AuthGuard → TenantContext → CacheInterceptor.intercept()
  1. cachePolicy = cachePolicyService.getPolicy(orgId)
  2. if !policy.enabled → next.handle() (LLM 직접 호출)
  3. queryHash = sha256(model + messages.content)
  4. embedding = embeddingService.embed(messages.content)  // fail → skip cache
  5. cacheEntry = cacheService.findSimilar(orgId, model, embedding, policy.threshold)
  6. if cacheEntry → return cached response + X-Cache: HIT + record hit
  7. else → next.handle() → pipe(tap(response => cacheService.store(...)))
     → X-Cache: MISS + return LLM response
```

### 임베딩 생성

```
EmbeddingService.embed(text):
  1. POST /v1/embeddings (OpenAI API)
     body: { model: "text-embedding-3-small", input: text }
  2. return response.data[0].embedding (float[])
  3. 실패 시 → null 반환 (fail-open, 캐시 스킵)
```

### 캐시 유사도 검색 (pgvector)

```sql
SELECT id, response, tokens_saved,
       1 - (query_vector <=> $1::vector) AS similarity
FROM cache_entry
WHERE org_id = $2
  AND model = $3
  AND expires_at > NOW()
  AND 1 - (query_vector <=> $1::vector) >= $4
ORDER BY similarity DESC
LIMIT 1;
```

### RBAC 규칙

| Role | Stats | Invalidate | Policy |
|------|-------|-----------|--------|
| admin | ✅ | ✅ | ✅ |
| member | ✅ | ✅ | ❌ |
| viewer | ✅ | ❌ | ❌ |

## Complexity Tracking

해당 없음. Constitution 위반 없음.
