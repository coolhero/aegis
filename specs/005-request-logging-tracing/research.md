# Research: F005 — Request Logging & Tracing

**Feature**: F005 — Request Logging & Tracing
**Date**: 2026-03-26
**Phase**: 0 (Research)

## R1: Langfuse Node.js SDK 통합 패턴

**Decision**: `langfuse-node` SDK를 사용하여 fire-and-forget 방식으로 trace/generation 전송
**Rationale**: 공식 SDK가 자체 flush 스케줄러와 배치 전송을 내장. `Langfuse` 클래스 인스턴스가 `trace()` → `generation()` 호출 후 백그라운드에서 flush.
**Alternatives considered**:
- Langfuse REST API 직접 호출 → SDK가 이미 배치/재시도/flush를 처리하므로 불필요한 재구현
- OpenTelemetry Exporter → Langfuse의 OTel 수신기는 아직 실험적, 직접 SDK가 안정적

## R2: BullMQ 비동기 로깅 아키텍처

**Decision**: `request-log` 큐에 로그 데이터를 enqueue, 별도 워커가 DB 쓰기 수행
**Rationale**: API 응답 경로에서 DB 쓰기를 분리하여 레이턴시 영향 제거. BullMQ는 F001에서 이미 설정된 Redis를 공유.
**Alternatives considered**:
- 동기 DB 쓰기 → 로깅이 API 레이턴시에 직접 영향, 성능 격리 원칙 위반
- Kafka → MVP에서 과잉. Redis/BullMQ로 충분

## R3: 분석 쿼리 전략

**Decision**: PostgreSQL `GROUP BY` + `DATE_TRUNC` 조합으로 기간별/차원별 집계
**Rationale**: MVP 단계에서 로그 볼륨이 관리 가능한 수준. 전용 OLAP은 F012 이후 검토.
**Alternatives considered**:
- Materialized View → 실시간성과 관리 복잡도 증가. 필요 시 후일 추가
- TimescaleDB → 추가 의존성. PostgreSQL 기본 기능으로 충분

## R4: OpenTelemetry Trace Context 전파

**Decision**: `@opentelemetry/api`의 `trace.getActiveSpan()` + `context.active()`로 trace_id 추출
**Rationale**: OTel은 분산 트레이싱 산업 표준. NestJS에서는 미들웨어/인터셉터에서 span context를 전파할 수 있음.
**Alternatives considered**:
- 자체 trace_id 생성 (UUID) → OTel 호환성 없음, 외부 시스템 연동 불가
- Jaeger SDK 직접 사용 → OTel이 벤더 중립적

## R5: 대용량 콘텐츠 Truncation 전략

**Decision**: input/output을 10KB로 truncate, 원본 크기를 `input_size`/`output_size` 컬럼에 기록
**Rationale**: 100K+ 토큰 프롬프트를 DB에 저장하면 쿼리 성능 저하. 10KB면 디버깅에 충분.
**Alternatives considered**:
- 전체 저장 + TOAST 압축 → PostgreSQL TOAST가 처리하지만 인덱스/쿼리 영향
- S3 외부 스토리지 → MVP에서 과잉, 후일 필요 시 확장

## R6: 인메모리 폴백 버퍼링 (Redis 끊김 시)

**Decision**: BullMQ 연결 실패 시 인메모리 큐(최대 1000건)에 버퍼링, 재연결 시 flush
**Rationale**: 로그 유실 방지. 1000건 제한으로 메모리 과부하 방지.
**Alternatives considered**:
- 즉시 동기 DB 쓰기 폴백 → API 레이턴시 영향, 성능 격리 원칙 위반
- 로그 드롭 → 감사 추적 원칙 위반
