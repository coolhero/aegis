# Feature Specification: F009 — Knowledge Integration

**Feature Branch**: `009-knowledge-integration`
**Created**: 2026-03-27
**Status**: Draft
**Input**: MCP 툴 서버 + pgvector RAG 하이브리드 지식 통합. 쿼리 유형 라우터, BullMQ 비동기 임베딩 파이프라인.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 문서 업로드 및 임베딩 파이프라인 (Priority: P1)

조직 관리자가 내부 문서(텍스트/마크다운)를 업로드하면, 시스템이 BullMQ 큐를 통해 비동기로 문서를 청크 분할하고, 임베딩 모델(OpenAI text-embedding-3-small)로 벡터를 생성하여 pgvector에 저장한다. 관리자는 업로드 상태(pending → processing → done/failed)를 실시간으로 확인할 수 있다.

**Why this priority**: RAG의 전제 조건. 문서가 벡터화되지 않으면 지식 검색이 불가.

**Independent Test**: 문서 업로드 API → BullMQ 큐 → 청크 분할(500 토큰 + 50 오버랩) → 임베딩 생성 → embedding_status='done' 확인.

**Acceptance Scenarios**:

1. **Given** 인증된 admin, **When** `POST /documents`에 title + content(마크다운 1000자) 전송, **Then** 문서 생성 + `embedding_status: 'pending'` + 202 Accepted.
2. **Given** 문서 업로드 완료, **When** BullMQ 워커가 처리, **Then** 500 토큰 크기 + 50 토큰 오버랩으로 청크 분할 → 각 청크에 임베딩 생성 → embedding_status='done'.
3. **Given** 문서 처리 중, **When** `GET /documents/:id`, **Then** `embedding_status: 'processing'` + `chunk_count: N`.
4. **Given** 임베딩 생성 중 프로바이더 에러 발생, **When** 재시도 3회 실패, **Then** `embedding_status: 'failed'` + 에러 상세 기록.
5. **Given** admin, **When** `GET /documents`, **Then** 조직의 문서 목록 (title, status, chunk_count, created_at).
6. **Given** admin, **When** `DELETE /documents/:id`, **Then** 문서 + 관련 임베딩 모두 삭제.
7. **Given** viewer 역할, **When** `POST /documents` 시도, **Then** 403 Forbidden (문서 업로드는 admin만 가능).

---

### User Story 2 — RAG 지식 검색 (Priority: P1)

사용자가 `POST /knowledge/query`로 질문을 보내면, 시스템이 질문을 임베딩한 후 pgvector에서 코사인 유사도 기반으로 가장 관련 높은 문서 청크를 검색한다. 검색된 청크를 컨텍스트로 포함한 결과를 반환한다.

**Why this priority**: 핵심 가치 — 내부 지식 기반 답변 제공.

**Independent Test**: 문서 임베딩 완료 상태 → 관련 질문 쿼리 → top-K 결과 + 유사도 점수 반환.

**Acceptance Scenarios**:

1. **Given** 임베딩 완료된 문서가 있는 org, **When** `POST /knowledge/query { "query": "서버 배포 절차는?" }`, **Then** 관련 청크 top-5 반환 + 각 결과에 `{ content, similarity, document_id, chunk_index }`.
2. **Given** 유사도 임계치 0.7 설정, **When** 쿼리 결과 중 유사도 < 0.7인 청크, **Then** 결과에서 제외.
3. **Given** 다른 org의 문서가 존재, **When** 쿼리 실행, **Then** 자기 org의 문서만 검색 (테넌트 격리).
4. **Given** 임베딩된 문서가 없는 org, **When** 쿼리 실행, **Then** 빈 배열 + "문서를 먼저 업로드하세요" 메시지.

---

### User Story 3 — MCP 서버 관리 및 도구 호출 (Priority: P2)

조직 관리자가 외부 MCP(Model Context Protocol) 서버를 등록하면, 시스템이 해당 서버의 도구 목록을 조회하고 캐싱한다. 사용자 쿼리가 MCP 도구 관련인 경우, 시스템이 해당 MCP 서버에 JSON-RPC 호출을 수행하여 실시간 데이터를 가져온다.

**Why this priority**: 실시간 데이터 접근. RAG만으로는 정적 문서만 검색 가능. MCP로 동적 데이터(DB 조회, API 호출 등) 접근.

**Independent Test**: MCP 서버 등록 → 도구 목록 조회 → 도구 호출 → 결과 반환.

**Acceptance Scenarios**:

1. **Given** admin, **When** `POST /mcp-servers { name, url, protocolVersion }`, **Then** MCP 서버 등록 + 도구 목록 자동 조회(`tools/list`) + 캐싱.
2. **Given** 등록된 MCP 서버, **When** `GET /mcp-servers`, **Then** org의 MCP 서버 목록 + 각 서버의 도구(tools) 목록.
3. **Given** 등록된 MCP 서버, **When** `POST /mcp-servers/:id/call { tool, arguments }`, **Then** JSON-RPC `tools/call` → 결과 반환.
4. **Given** MCP 서버가 응답하지 않음, **When** 도구 호출 시 5초 타임아웃, **Then** 504 Gateway Timeout + 에러 상세.
5. **Given** admin, **When** `DELETE /mcp-servers/:id`, **Then** MCP 서버 삭제.

---

### User Story 4 — 쿼리 유형 라우터 (Priority: P2)

사용자 쿼리가 도착하면 시스템이 쿼리 내용을 분석하여 MCP 도구 호출이 필요한지, RAG 문서 검색이 필요한지, 또는 둘 다 필요한지 자동으로 판단한다. 라우터는 키워드 패턴과 등록된 MCP 도구 이름을 기반으로 결정한다.

**Why this priority**: 지식 통합의 완성도. 사용자가 수동으로 MCP/RAG를 선택하지 않아도 되도록 자동화.

**Independent Test**: MCP 관련 쿼리 → MCP로 라우팅. 문서 관련 쿼리 → RAG로 라우팅. 혼합 쿼리 → 둘 다.

**Acceptance Scenarios**:

1. **Given** MCP 서버에 `query_database` 도구 등록, **When** "최근 주문 현황 조회해줘" 쿼리, **Then** 라우터가 MCP 선택 (도구 이름 매칭).
2. **Given** 문서 "서버 배포 가이드" 임베딩 완료, **When** "서버 배포 절차를 알려줘" 쿼리, **Then** 라우터가 RAG 선택 (문서 유사도 기반).
3. **Given** MCP + RAG 모두 관련, **When** 혼합 쿼리, **Then** 라우터가 HYBRID 결정 → MCP 결과 + RAG 결과 모두 반환.
4. **Given** MCP 서버 미등록 + 문서 미업로드, **When** 쿼리, **Then** `{ type: 'none', message: '지식 소스를 먼저 설정하세요' }`.

---

### Edge Cases

- 매우 긴 문서 (100,000자+) → 청크 분할 시 200+ 청크 → BullMQ 배치 처리
- 임베딩 모델 프로바이더 변경 시 → 기존 벡터와 차원 불일치 → 문서 재임베딩 필요 (경고 표시)
- MCP 서버가 등록 후 다운 → 헬스체크 실패 → health_status='unhealthy'
- 동일 문서 중복 업로드 → title 기반 중복 경고 (허용은 함)
- pgvector 인덱스 없이 대량 벡터 검색 → 성능 저하 (mvp에서는 HNSW 인덱스 권장)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `POST /documents` API로 텍스트/마크다운 문서를 업로드할 수 있어야 한다. Admin 권한 필요. 응답은 202 Accepted + 문서 ID.
- **FR-002**: 시스템은 `GET /documents`, `GET /documents/:id`, `DELETE /documents/:id` API를 제공해야 한다. 테넌트 격리.
- **FR-003**: 시스템은 업로드된 문서를 500 토큰 크기 + 50 토큰 오버랩으로 청크 분할해야 한다.
- **FR-004**: 시스템은 각 청크에 대해 임베딩 모델(OpenAI text-embedding-3-small, 1536차원)로 벡터를 생성해야 한다. Provider 추상화를 통해 임베딩 모델 교체 가능.
- **FR-005**: 시스템은 벡터를 pgvector에 저장해야 한다. 코사인 유사도 검색 지원. 테넌트 격리(org_id 필터).
- **FR-006**: 시스템은 BullMQ를 통해 문서 임베딩을 비동기로 처리해야 한다. 실패 시 3회 재시도.
- **FR-007**: 시스템은 `POST /knowledge/query`로 RAG 검색을 제공해야 한다. 쿼리 임베딩 → cosine similarity 검색 → top-K (기본 5) → 유사도 임계치 필터(기본 0.7).
- **FR-008**: 시스템은 `POST/GET/DELETE /mcp-servers` API로 MCP 서버를 관리해야 한다. 등록 시 `tools/list` 자동 호출.
- **FR-009**: 시스템은 `POST /mcp-servers/:id/call` API로 MCP 도구를 호출해야 한다. JSON-RPC 2.0. 타임아웃 5초.
- **FR-010**: 시스템은 쿼리 유형 라우터를 통해 MCP/RAG/HYBRID/NONE을 자동 선택해야 한다.
- **FR-011**: 시스템은 문서 삭제 시 관련 임베딩을 모두 함께 삭제해야 한다 (cascade).

### Key Entities

- **Document**: id, org_id, title, content_type, content, chunk_count, embedding_status, error_detail, created_at
- **Embedding**: id, document_id, chunk_index, content (원문 청크), vector (pgvector 1536차원), metadata (jsonb), created_at
- **McpServer**: id, org_id, name, url, protocol_version, tools (jsonb), enabled, health_status, created_at

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /documents`로 문서 업로드 → 202 + 문서 ID. BullMQ 큐에 job 생성 확인.
- **SC-002**: BullMQ 워커가 문서를 500토큰+50오버랩으로 청크 분할 → 각 청크에 1536차원 임베딩 생성 → pgvector 저장 → `embedding_status='done'`.
- **SC-003**: `POST /knowledge/query`로 쿼리 → cosine similarity 검색 → 유사도 0.7 이상 top-5 청크 반환 + 각 결과에 similarity 점수.
- **SC-004**: `POST /mcp-servers`로 MCP 서버 등록 → `tools/list` 자동 호출 → 도구 목록 캐싱. `POST /mcp-servers/:id/call`로 도구 호출 → 결과 반환.
- **SC-005**: 다른 org의 문서는 RAG 검색에서 절대 반환되지 않는다 (테넌트 격리).
- **SC-006**: 임베딩 중 프로바이더 에러 발생 → 3회 재시도 후 `embedding_status='failed'` + error_detail 기록.
- **SC-007**: 쿼리 라우터가 MCP 도구명 매칭 쿼리 → 'mcp', 문서 관련 쿼리 → 'rag', 혼합 → 'hybrid' 반환.
- **SC-008**: MCP 도구 호출 시 5초 이내 응답 없으면 504 Gateway Timeout.
- **SC-009**: `DELETE /documents/:id` → 문서 + 관련 임베딩 모두 삭제.

## Assumptions

- pgvector 확장은 PostgreSQL에 설치 가능 (Docker Compose에 반영).
- 임베딩 모델은 OpenAI text-embedding-3-small (1536차원) 기본 사용. Provider 추상화로 교체 가능.
- MCP 프로토콜은 표준 JSON-RPC 2.0 기반.
- BullMQ는 Redis 의존 (F001에서 이미 구성).
- 쿼리 라우터는 MVP에서 키워드 패턴 + MCP 도구명 매칭 방식. 고급 의도 분류는 향후 개선.
- 문서 형식은 MVP에서 텍스트/마크다운만 지원. PDF/DOCX는 향후.
- 벡터 검색 인덱스는 HNSW (pgvector 기본).
