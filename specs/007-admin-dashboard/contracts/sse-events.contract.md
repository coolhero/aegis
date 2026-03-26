# API Contract: SSE Events Stream

**Feature**: F007 — Admin Dashboard
**Base Path**: `/events`

---

## GET /events/stream

SSE(Server-Sent Events) 실시간 이벤트 스트림. JWT 인증 필수. 테넌트 격리.

### Request

```
GET /events/stream
Authorization: Bearer <accessToken>
Accept: text/event-stream
```

### Response — 200 OK (text/event-stream)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Types

#### request_completed

LLM 요청 완료 시 발행.

```
event: request_completed
data: {"request_id":"uuid","model":"gpt-4o","provider":"openai","input_tokens":150,"output_tokens":50,"cost_usd":0.000875,"latency_ms":1200,"status":"success","user_id":"uuid"}
```

#### budget_alert

예산 임계치 도달 시 발행.

```
event: budget_alert
data: {"budget_id":"uuid","level":"org","threshold":80,"usage_pct":81.5}
```

#### ping (heartbeat)

30초 간격 keep-alive.

```
event: ping
data: {"timestamp":"2026-03-26T10:00:00Z"}
```

### 테넌트 격리

- JWT의 `orgId` claim으로 테넌트 식별
- 각 SSE 연결은 해당 org의 이벤트만 수신
- 다른 org의 이벤트는 절대 전달되지 않음

### 연결 관리

- 클라이언트 disconnected → 서버 측 연결 정리 (response close 이벤트)
- 최대 연결 수: org당 50개 (초과 시 가장 오래된 연결 종료)
- heartbeat 30초 간격 → 클라이언트에서 45초 timeout 설정 권장

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```
