# Tasks: F009 — Knowledge Integration

**Feature**: F009 — Knowledge Integration
**Branch**: `009-knowledge-integration`
**Generated**: 2026-03-27
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Implementation Strategy

- **MVP**: Phase 1-3 (엔티티 + 문서 관리 + 임베딩 파이프라인 + RAG)
- **Full**: + Phase 4 (MCP) + Phase 5 (라우터) + Phase 6 (Polish)
- **Micro-Verify**: 각 task 완료 후 curl로 즉시 확인 (P12 교훈 반영)

## Dependencies

```
Phase 1 (Foundation) → Phase 2 (US1 문서+임베딩) → Phase 3 (US2 RAG) → Phase 4 (US3 MCP) → Phase 5 (US4 라우터) → Phase 6 (Polish)
```

---

## Phase 1: Foundation (엔티티 + 모듈 셋업)

- [ ] T001 pgvector 확장 설치 — Docker Compose에 pgvector 이미지 확인 + 마이그레이션에 `CREATE EXTENSION IF NOT EXISTS vector` 추가. **Micro-Verify**: DB 접속 → `SELECT * FROM pg_extension WHERE extname='vector'`
- [ ] T002 엔티티 생성 — `document.entity.ts`, `embedding.entity.ts`, `mcp-server.entity.ts` TypeORM 엔티티. Embedding의 vector 컬럼은 `float8[]` + raw SQL로 pgvector 연산. **Micro-Verify**: `npm run build` 통과
- [ ] T003 Knowledge 모듈 셋업 — `knowledge.module.ts`: TypeOrmModule.forFeature([Document, Embedding, McpServer]), BullModule.registerQueue('embedding'), 컨트롤러/서비스 등록. AppModule에 KnowledgeModule import. **Micro-Verify**: `npm run build` + 서버 시작 (health check)

---

## Phase 2: US1 — 문서 업로드 + 임베딩 파이프라인 (P1)

**Goal**: 문서 업로드 → BullMQ → 청크 → 임베딩 → pgvector
**Micro-Verify**: 각 task 후 curl

- [ ] T004 ChunkerService — `chunker.service.ts`: 텍스트를 토큰 추정(단어수×1.3) 기반 500 토큰 + 50 오버랩으로 분할. **Micro-Verify**: 단위 테스트 (chunker.service.spec.ts)
- [ ] T005 DocumentController + DocumentService — `document.controller.ts`, `document.service.ts`: POST /documents (202), GET /documents, GET /documents/:id, DELETE /documents/:id (cascade). JwtAuthGuard + Roles(admin) for POST/DELETE. **Micro-Verify**: 서버 시작 → `curl -X POST /documents` → 202, `curl GET /documents` → 200
- [ ] T006 EmbeddingService — `embedding.service.ts`: generateEmbedding(text) → Provider API (text-embedding-3-small), saveBulk(embeddings), search(queryVector, orgId, topK, threshold) → raw SQL cosine similarity. **Micro-Verify**: 단위 테스트 (mock provider)
- [ ] T007 EmbeddingWorker — `embedding.worker.ts`: BullMQ Processor. Document 조회 → status:processing → ChunkerService.chunk() → EmbeddingService.generate() each → EmbeddingService.saveBulk() → status:done. 3회 재시도. 실패 시 status:failed + errorDetail. **Micro-Verify**: 서버 시작 → 문서 업로드 → `GET /documents/:id` → status progression 확인

---

## Phase 3: US2 — RAG 지식 검색 (P1)

**Goal**: 쿼리 임베딩 → pgvector 검색 → top-K 반환
**Micro-Verify**: curl

- [ ] T008 KnowledgeQueryService — `knowledge-query.service.ts`: query(text, orgId, topK, threshold) → EmbeddingService.generateEmbedding(text) → EmbeddingService.search(vector, orgId, topK, threshold) → 결과 조합. **Micro-Verify**: 단위 테스트 (mock embedding)
- [ ] T009 KnowledgeQueryController — `knowledge-query.controller.ts`: POST /knowledge/query. JwtAuthGuard. Request: { query, topK?, threshold? }. **Micro-Verify**: 서버 시작 → 문서 업로드 + 임베딩 완료 대기 → `curl POST /knowledge/query` → 결과 확인

---

## Phase 4: US3 — MCP 서버 관리 + 도구 호출 (P2)

**Goal**: MCP 서버 등록 → tools/list → tools/call
**Micro-Verify**: curl

- [ ] T010 McpServerService — `mcp-server.service.ts`: create(data) → HTTP GET tools/list → tools 캐싱. callTool(serverId, tool, arguments) → HTTP POST JSON-RPC tools/call, 5s timeout. findAll(orgId), delete(id). **Micro-Verify**: 단위 테스트
- [ ] T011 McpServerController — `mcp-server.controller.ts`: POST /mcp-servers (Admin), GET /mcp-servers, DELETE /mcp-servers/:id (Admin), POST /mcp-servers/:id/call. JwtAuthGuard. **Micro-Verify**: 서버 시작 → `curl POST /mcp-servers` → 등록 확인

---

## Phase 5: US4 — 쿼리 유형 라우터 (P2)

**Goal**: MCP vs RAG vs HYBRID vs NONE 자동 선택

- [ ] T012 QueryRouterService — `query-router.service.ts`: route(query, orgId) → 등록된 MCP 도구 이름 매칭 → RAG 문서 존재 여부 → 결정. **Micro-Verify**: 단위 테스트
- [ ] T013 KnowledgeQueryService 라우터 통합 — `knowledge-query.service.ts`에 QueryRouterService 통합. HYBRID 시 MCP + RAG 결과 병합. **Micro-Verify**: 서버 시작 → 라우터 결정이 올바른지 `curl POST /knowledge/query` 확인

---

## Phase 6: Polish

- [ ] T014 테넌트 격리 테스트 — 다른 org의 문서/MCP 서버가 검색/접근 불가 확인
- [ ] T015 데모 스크립트 — `demos/F009-knowledge-integration.sh`: API 서버 시작 → 문서 업로드 → 임베딩 대기 → RAG 쿼리 → 결과 표시. --ci 모드
- [ ] T016 단위 테스트 — chunker, embedding search, query router, mcp call 테스트

---

## Summary

| Phase | Tasks | User Story |
|-------|-------|------------|
| 1. Foundation | T001-T003 | — |
| 2. US1 Document+Embedding | T004-T007 | P1 |
| 3. US2 RAG Query | T008-T009 | P1 |
| 4. US3 MCP | T010-T011 | P2 |
| 5. US4 Router | T012-T013 | P2 |
| 6. Polish | T014-T016 | — |

**Total**: 16 tasks
**MVP Scope**: Phase 1-3 (T001-T009, 9 tasks)
