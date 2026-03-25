# Specification: F001 — Foundation Setup

## Overview

AEGIS 플랫폼의 기반 인프라를 구성하는 Foundation Feature. NestJS 모노레포 프로젝트 구조, PostgreSQL/Redis 연결, Docker Compose 로컬 개발 환경, 헬스체크 엔드포인트, 환경변수 관리를 포함.

## Functional Requirements

### FR-001: NestJS Monorepo 프로젝트 구조
NestJS CLI 기반 monorepo 구조를 설정한다. `apps/api` (백엔드 서버)와 `libs/common` (공유 모듈)으로 구성한다.

### FR-002: PostgreSQL 데이터베이스 연결
TypeORM을 사용하여 PostgreSQL에 연결한다. 마이그레이션 파일 기반 스키마 관리를 적용한다. (auto-sync는 개발 환경에서만 허용)

### FR-003: Redis 연결
`ioredis`를 사용하여 Redis에 연결한다. 연결 실패 시 앱은 기동되되, Redis 의존 기능은 비활성화된다 (graceful degradation).

### FR-004: Docker Compose 로컬 환경
`docker-compose.yml`로 PostgreSQL, Redis, App 서비스를 정의한다. `docker compose up` 원커맨드로 전체 환경을 기동할 수 있다.

### FR-005: Health Check 엔드포인트
`GET /health` 엔드포인트를 제공한다. 각 컴포넌트(DB, Redis)의 개별 상태와 전체 상태를 JSON으로 반환한다.

### FR-006: 환경변수 관리
`@nestjs/config`와 `class-validator`를 사용하여 환경변수를 타입 안전하게 관리한다. 필수 변수 누락 시 앱 기동을 실패시킨다.

### FR-007: 공통 모듈
Logger (structured JSON), Exception Filter (표준 에러 응답), Response Interceptor (표준 응답 래핑)를 libs/common에 구현한다.

## Success Criteria

### SC-001: 프로젝트 빌드 성공
`npm run build` 명령이 에러 없이 완료된다. TypeScript 컴파일 에러가 없다.

### SC-002: PostgreSQL 연결 확인
앱 기동 시 PostgreSQL에 연결되고, `GET /health`에서 `db: "up"` 상태를 반환한다.

### SC-003: Redis 연결 확인
앱 기동 시 Redis에 연결되고, `GET /health`에서 `redis: "up"` 상태를 반환한다.

### SC-004: Redis Graceful Degradation
Redis가 미기동 상태에서 앱이 정상 기동된다. `GET /health`에서 `redis: "down"`, `overall: "degraded"` 상태를 반환한다.

### SC-005: Docker Compose 원커맨드 기동
`docker compose up -d` 명령으로 postgres, redis, app 컨테이너가 모두 기동된다. `curl localhost:3000/health`가 200을 반환한다.

### SC-006: 환경변수 검증
필수 환경변수(`DATABASE_URL`, `REDIS_URL`) 누락 시 앱이 기동 실패하고 명확한 에러 메시지를 출력한다.

### SC-007: 공통 모듈 동작
에러 발생 시 Exception Filter가 표준 JSON 에러 응답(`{ statusCode, message, error }`)을 반환한다.

### SC-008: 마이그레이션 실행
`npm run migration:run` 명령으로 TypeORM 마이그레이션이 정상 실행된다.

## Scope Boundaries

### In Scope
- NestJS monorepo 구조 (apps/api + libs/common)
- PostgreSQL + Redis 연결 모듈
- Docker Compose 로컬 환경
- Health check, 환경변수 관리, 공통 모듈

### Out of Scope
- 인증/인가 (F003)
- LLM 관련 기능 (F002)
- CI/CD 파이프라인 구성
- 프로덕션 배포 설정
