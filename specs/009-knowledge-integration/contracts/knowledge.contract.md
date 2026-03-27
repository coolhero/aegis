# API Contracts: F009 — Knowledge Integration

## POST /documents

문서 업로드. 비동기 임베딩 처리.

### Request

```json
{
  "title": "서버 배포 가이드",
  "content": "# 배포 절차\n\n1. Docker 이미지 빌드...",
  "contentType": "text/markdown"
}
```

### Response — 202 Accepted

```json
{
  "id": "uuid",
  "title": "서버 배포 가이드",
  "embeddingStatus": "pending",
  "chunkCount": 0,
  "createdAt": "2026-03-27T10:00:00Z"
}
```

---

## POST /knowledge/query

RAG 지식 검색.

### Request

```json
{
  "query": "서버 배포 절차는?",
  "topK": 5,
  "threshold": 0.7
}
```

### Response — 200 OK

```json
{
  "type": "rag",
  "results": [
    {
      "content": "1. Docker 이미지를 빌드합니다...",
      "similarity": 0.92,
      "documentId": "uuid",
      "documentTitle": "서버 배포 가이드",
      "chunkIndex": 0
    }
  ]
}
```

---

## POST /mcp-servers/:id/call

MCP 도구 호출.

### Request

```json
{
  "tool": "query_database",
  "arguments": { "sql": "SELECT * FROM orders LIMIT 5" }
}
```

### Response — 200 OK

```json
{
  "result": {
    "content": [{ "type": "text", "text": "[{\"id\":1, ...}]" }]
  }
}
```

### Response — 504 Gateway Timeout

```json
{
  "statusCode": 504,
  "message": "MCP server did not respond within 5 seconds",
  "error": "Gateway Timeout"
}
```
