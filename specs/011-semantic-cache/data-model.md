# Data Model: F011 — Semantic Cache

## CacheEntry

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default uuid_generate_v4() | 캐시 엔트리 ID |
| org_id | varchar | NOT NULL, INDEX | 테넌트 ID |
| model | varchar | NOT NULL | LLM 모델명 (gpt-4, claude-3 등) |
| query_hash | varchar | NOT NULL, INDEX | 쿼리 SHA256 해시 (정확히 동일 쿼리 빠른 조회) |
| query_vector | vector(1536) | NOT NULL | 쿼리 임베딩 벡터 (pgvector) |
| response | jsonb | NOT NULL | 캐시된 LLM 응답 (원본 형식 보존) |
| tokens_saved | integer | DEFAULT 0 | 이 캐시로 절감된 토큰 수 |
| hit_count | integer | DEFAULT 0 | 히트 횟수 |
| ttl | integer | NOT NULL | TTL (초) |
| created_at | timestamptz | DEFAULT NOW() | 생성 시각 |
| expires_at | timestamptz | NOT NULL, INDEX | 만료 시각 (created_at + ttl) |

**Indexes**:
- `idx_cache_entry_org_model` ON (org_id, model)
- `idx_cache_entry_vector` USING ivfflat (query_vector vector_cosine_ops) WITH (lists = 100)
- `idx_cache_entry_expires` ON (expires_at)
- `idx_cache_entry_hash` ON (org_id, model, query_hash)

## CachePolicy

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default uuid_generate_v4() | 정책 ID |
| org_id | varchar | NOT NULL, UNIQUE | 테넌트 ID (org당 1개) |
| similarity_threshold | decimal(3,2) | DEFAULT 0.95 | 유사도 임계치 (0.0~1.0) |
| ttl_seconds | integer | DEFAULT 86400 | 캐시 TTL (초) |
| enabled | boolean | DEFAULT true | 캐시 활성화 여부 |
| created_at | timestamptz | DEFAULT NOW() | 생성 시각 |
| updated_at | timestamptz | DEFAULT NOW() | 수정 시각 |

## Relationships

```
CacheEntry.org_id → Organization.id (F003)
CachePolicy.org_id → Organization.id (F003)
CacheEntry.model → Model.name (F002, 참조만)
```
