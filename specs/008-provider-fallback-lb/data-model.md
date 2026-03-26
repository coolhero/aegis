# Data Model: F008 — Provider Fallback & Load Balancing

## CircuitBreaker State (Redis — not a DB entity)

서킷 브레이커 상태는 Redis Hash로 관리. 멀티 인스턴스 동기화.

```typescript
interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureAt: string | null;  // ISO timestamp
  openedAt: string | null;       // OPEN 전이 시각
}
```

**Redis Key**: `circuit:{providerId}`

### 설정 파라미터

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| failureThreshold | number | 5 | OPEN 전이를 위한 연속 실패 횟수 |
| recoveryTimeout | number | 30000 | OPEN → HALF_OPEN 전이 대기 시간 (ms) |
| probeTimeout | number | 5000 | HALF_OPEN 프로브 요청 타임아웃 (ms) |

## Latency Metrics (Redis SortedSet)

**Redis Key**: `latency:{providerId}`
- **Score**: 타임스탬프 (Date.now())
- **Member**: `{timestamp}:{latency_ms}`
- **Window**: 5분 (300,000ms). 오래된 항목은 `ZREMRANGEBYSCORE`로 제거.

### 계산

```typescript
// 평균 레이턴시 (최근 5분)
const entries = await redis.zrangebyscore(key, Date.now() - 300000, Date.now());
const avgLatency = entries.reduce((sum, e) => sum + parseInt(e.split(':')[1]), 0) / entries.length;

// 에러율 (최근 5분)
const errorKey = `errors:${providerId}`;
const totalKey = `requests:${providerId}`;
const errorRate = parseInt(await redis.get(errorKey) || '0') / parseInt(await redis.get(totalKey) || '1');
```

## Provider Entity Extension

F002의 Provider 엔티티에 이미 `health_status`, `weight` 필드가 존재. F008에서는 추가 DB 컬럼 없이 Redis 상태로 서킷 브레이커를 관리.

## FallbackChain (설정 기반)

폴백 체인은 모델별로 `Provider` 테이블의 `enabled=true` + `weight` 기반으로 자동 구성.
별도 테이블 없이 런타임 정렬로 처리 (YAGNI).
