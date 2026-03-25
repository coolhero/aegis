# Pre-Context: F009 — Knowledge Integration

## Feature Summary
MCP 툴 서버와 pgvector 기반 RAG 하이브리드 지식 통합. 쿼리 유형 라우터(MCP vs RAG 자동 선택)와 BullMQ 비동기 문서 임베딩 파이프라인을 제공한다.

## User & Purpose
- **Actor(s)**: 조직 관리자 (지식 소스 설정), 개발자 (문서 업로드), AI 서비스 소비자 (지식 증강 응답)
- **Problem**: LLM이 조직 내부 지식에 접근하지 못하면 일반적인 답변만 제공. 실시간 도구 호출(MCP)과 문서 기반 검색(RAG)을 통합한 지식 증강이 필요.
- **Key Scenarios**: 사용자 질문에 대해 내부 문서 검색 후 컨텍스트 포함 응답, MCP 도구 서버로 실시간 데이터 조회, 쿼리 유형에 따라 MCP/RAG 자동 선택, 문서 업로드 후 백그라운드 임베딩

## Capabilities
- MCP (Model Context Protocol) 툴 서버 연동
- pgvector 기반 벡터 검색 (RAG)
- 쿼리 유형 라우터 (MCP vs RAG 자동 선택)
- 문서 임베딩 파이프라인 (BullMQ 비동기 처리)
- 문서 업로드/관리 API
- 임베딩 모델 설정 (OpenAI text-embedding-3-small 등)
- 청크 분할 전략 (토큰 기반 고정 크기 + 오버랩)

## Data Ownership
- **Owns**: Document (업로드 문서), Embedding (벡터 임베딩), McpServer (MCP 서버 설정)
- **References**: Organization (F003), Provider (F002)

## Interfaces
- **Provides**: `POST /documents` (문서 업로드), `GET /documents` (목록), `DELETE /documents/:id`, `POST /knowledge/query` (지식 검색), `GET /mcp-servers` (MCP 서버 관리)
- **Consumes**: F002 LLM API (임베딩 생성용), F003 TenantContext

## Dependencies
- F002 LLM Gateway Core
- F003 Auth & Multi-tenancy

## Domain-Specific Notes
- **ai-gateway A1 Provider Abstraction**: 임베딩 생성도 Provider 추상화를 통해 수행. 임베딩 모델 프로바이더 교체 시 설정만 변경.
- pgvector 확장은 F001 PostgreSQL에 추가 설치 필요 (Docker Compose에 반영)
- MCP 프로토콜은 표준 JSON-RPC 기반. 외부 MCP 서버 등록/연결 관리.

## For /speckit.specify
- SC 필수: 쿼리 라우터 분류 기준 (키워드, 의도 분류, 하이브리드)
- SC 필수: RAG 파이프라인 (쿼리 임베딩 → 벡터 검색 → 상위 K개 → 프롬프트 컨텍스트 주입)
- SC 필수: 문서 임베딩 파이프라인 (업로드 → 청크 분할 → 임베딩 생성 → 벡터 저장) — BullMQ 비동기
- SC 필수: MCP 서버 등록/연결/호출 플로우
- 벡터 검색 유사도 임계치 결정 필요 (cosine similarity threshold)
- 테넌트별 문서/MCP 서버 격리 보장
