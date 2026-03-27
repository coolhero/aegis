# Implementation Plan: F009 — Knowledge Integration

**Branch**: `009-knowledge-integration` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)

## Summary

pgvector 기반 RAG + MCP 툴 서버 + BullMQ 비동기 임베딩 파이프라인을 NestJS 백엔드에 추가한다. 3개 신규 엔티티 (Document, Embedding, McpServer), 7개 API 엔드포인트, 1개 BullMQ 워커를 구현한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, pgvector (pg_vector extension), BullMQ, axios (MCP JSON-RPC)
**Storage**: PostgreSQL + pgvector (벡터), Redis (BullMQ 큐, 임시 상태)
**Testing**: Jest + Supertest
**Project Type**: Backend service module (`apps/api/src/knowledge/`)
**Performance Goals**: RAG 쿼리 < 500ms, 임베딩 생성 비동기 (큐 기반)
**Constraints**: pgvector 확장 필수, 임베딩 모델 API key 필요

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| Provider Abstraction | ✅ 임베딩도 ProviderAdapter 통해 수행. 모델 교체 = 설정 변경 |
| Tenant Data Isolation | ✅ 모든 엔티티에 org_id. 벡터 검색 시 org_id 필터 |
| Start Simple (YAGNI) | ✅ MVP: 텍스트/마크다운만. PDF/DOCX는 향후 |

## Project Structure

```text
apps/api/src/knowledge/
├── knowledge.module.ts            # NestJS 모듈 (Document, Embedding, McpServer)
├── document.entity.ts             # Document TypeORM 엔티티
├── embedding.entity.ts            # Embedding TypeORM 엔티티 + pgvector column
├── mcp-server.entity.ts           # McpServer TypeORM 엔티티
├── document.controller.ts         # POST/GET/DELETE /documents
├── document.service.ts            # 문서 CRUD + BullMQ 큐 등록
├── embedding.service.ts           # 임베딩 생성 + pgvector 저장/검색
├── embedding.worker.ts            # BullMQ 워커 (청크 분할 → 임베딩 → 저장)
├── chunker.service.ts             # 텍스트 청크 분할 (500 토큰 + 50 오버랩)
├── knowledge-query.controller.ts  # POST /knowledge/query
├── knowledge-query.service.ts     # RAG 쿼리 (임베딩 → 벡터 검색 → top-K)
├── query-router.service.ts        # 쿼리 유형 분류 (MCP/RAG/HYBRID/NONE)
├── mcp-server.controller.ts       # POST/GET/DELETE /mcp-servers, POST /mcp-servers/:id/call
└── mcp-server.service.ts          # MCP 서버 관리 + JSON-RPC 호출

libs/common/src/
└── knowledge/
    └── index.ts                   # 엔티티 re-export
```

## Architecture

### 문서 임베딩 파이프라인 (비동기)

```
POST /documents → DocumentService.create()
  → DB에 Document 저장 (status: pending)
  → BullMQ 큐에 job 추가 (documentId)
  → 202 Accepted 반환

BullMQ Worker (embedding.worker.ts):
  → Document 조회 → status: processing
  → ChunkerService.chunk(content, 500, 50)
  → 각 청크에 대해:
     → EmbeddingService.generateEmbedding(chunk) // Provider API
     → Embedding 엔티티 저장 (content + vector)
  → Document.chunk_count = N, status: done
  → 실패 시: 3회 재시도 → status: failed + error_detail
```

### RAG 쿼리 플로우

```
POST /knowledge/query { query }
  → QueryRouterService.route(query, orgId)
     → 'rag' | 'mcp' | 'hybrid' | 'none'
  → if 'rag' or 'hybrid':
     → EmbeddingService.generateEmbedding(query)
     → EmbeddingService.search(queryVector, orgId, topK=5, threshold=0.7)
     → 결과: [{ content, similarity, document_id, chunk_index }]
  → if 'mcp' or 'hybrid':
     → McpServerService.findRelevantTool(query, orgId)
     → McpServerService.callTool(serverId, tool, arguments)
  → 응답 조합 반환
```

### MCP 도구 호출

```
POST /mcp-servers/:id/call { tool, arguments }
  → McpServer 조회 (org_id 격리)
  → HTTP POST to MCP server URL:
     { "jsonrpc": "2.0", "method": "tools/call", "params": { "name": tool, "arguments": arguments }, "id": 1 }
  → 5초 타임아웃
  → 결과 반환 또는 504 Timeout
```

### pgvector 설정

```sql
-- Docker Compose 또는 마이그레이션
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding 테이블
CREATE TABLE embedding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES document(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW 인덱스 (코사인 유사도)
CREATE INDEX embedding_vector_idx ON embedding USING hnsw (vector vector_cosine_ops);
```
