# Feature Specification: F001 — Foundation Setup

**Feature Branch**: `001-foundation-setup`
**Created**: 2025-03-25
**Status**: Implemented
**Input**: AEGIS 플랫폼 기반 인프라 — NestJS 모노레포, PostgreSQL, Redis, Docker Compose, 헬스 체크, 환경변수 관리

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Local Environment (Priority: P1)

백엔드 개발자가 AEGIS 프로젝트에 합류하여 최소한의 단계로 전체 개발 환경을 구축해야 한다. 레포지토리를 클론하고, `docker compose up -d`와 `npm run start:dev`를 실행하면 PostgreSQL, Redis, NestJS API 서버가 포함된 완전한 로컬 스택이 작동한다.

**Why this priority**: 작동하는 로컬 환경 없이는 다른 어떤 Feature도 개발하거나 테스트할 수 없다. 이것이 절대적인 기반이다.

**Independent Test**: `docker compose up -d && npm install && npm run start:dev`를 실행한 후 `curl localhost:3000/health`가 `status: "ok"`와 함께 200을 반환한다.

**Acceptance Scenarios**:

1. **Given** 레포지토리를 새로 클론한 상태에서, **When** 개발자가 `cp .env.example .env && docker compose up -d && npm install && npm run start:dev`를 실행하면, **Then** NestJS 애플리케이션이 오류 없이 시작되고 포트 3000에서 수신 대기한다.
2. **Given** 애플리케이션이 실행 중인 상태에서, **When** 개발자가 `GET /health`를 전송하면, **Then** 응답은 `200 OK`이며 `{ "status": "ok", "components": { "db": "up", "redis": "up" } }`이다.
3. **Given** Docker Compose 파일이 있는 상태에서, **When** `docker compose up -d`를 실행하면, **Then** PostgreSQL(포트 5432)과 Redis(포트 6379) 컨테이너가 실행되고 정상 상태이다.

---

### User Story 2 - Health Monitoring (Priority: P2)

DevOps 엔지니어가 AEGIS API와 그 의존성의 상태를 모니터링해야 한다. `GET /health` 엔드포인트는 각 인프라 구성요소(DB, Redis)의 개별 상태와 전체 상태를 보고하여 모니터링 대시보드 및 로드 밸런서 헬스 체크와의 통합을 가능하게 한다.

**Why this priority**: 헬스 모니터링은 프로덕션 준비성과 개발 중 인프라 문제 디버깅에 필수적이다.

**Independent Test**: 앱을 시작하고, Redis를 중지한 후, `/health`가 `"degraded"`를 반환하는지 확인한다. PostgreSQL을 중지하고, `/health`가 503을 반환하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 모든 인프라가 정상인 상태에서, **When** `GET /health`를 호출하면, **Then** 응답은 `200`이며 `status: "ok"`, `db: "up"`, `redis: "up"`이다.
2. **Given** Redis는 중지되었지만 PostgreSQL은 실행 중인 상태에서, **When** `GET /health`를 호출하면, **Then** 응답은 `200`이며 `status: "degraded"`, `db: "up"`, `redis: "down"`이다.
3. **Given** PostgreSQL이 중지된 상태에서, **When** `GET /health`를 호출하면, **Then** 응답은 `503`이며 `status: "error"`, `db: "down"`이다.
4. **Given** PostgreSQL과 Redis 모두 중지된 상태에서, **When** `GET /health`를 호출하면, **Then** 응답은 `503`이며 `status: "error"`, `db: "down"`, `redis: "down"`이다.

---

### User Story 3 - Fail-Fast Environment Validation (Priority: P3)

개발자가 `.env` 파일을 잘못 설정한다(필수 변수 누락 또는 잘못된 값). 애플리케이션은 런타임에 암호 같은 연결 오류로 실패하는 대신, 즉시 시작을 거부하고 모든 잘못된/누락된 변수를 나열하는 명확하고 실행 가능한 오류 메시지를 표시해야 한다.

**Why this priority**: 잘못된 설정으로 인한 런타임 오류 디버깅에 낭비되는 시간을 방지한다. 개발자 경험을 향상시킨다.

**Independent Test**: `.env`에서 `DATABASE_HOST`를 제거하고, `npm run start:dev`를 실행하여, 누락된 변수를 언급하는 메시지와 함께 즉시 실패하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** `.env`에 `DATABASE_HOST`가 누락된 상태에서, **When** 앱이 시작되면, **Then** `"DATABASE_HOST"`를 포함하는 오류 메시지와 함께 즉시 실패한다.
2. **Given** `.env`에 `DATABASE_PORT=not_a_number`가 있는 상태에서, **When** 앱이 시작되면, **Then** `DATABASE_PORT`에 대한 유효성 검사 오류와 함께 즉시 실패한다.
3. **Given** 모든 필수 변수가 존재하고 유효한 상태에서, **When** 앱이 시작되면, **Then** 유효성 검사 오류 없이 성공적으로 부팅된다.

---

### User Story 4 - Common Error Handling (Priority: P4)

API가 모든 엔드포인트에서 일관되고 구조화된 오류 응답을 반환한다. 처리되지 않은 예외가 발생하면 글로벌 예외 필터가 이를 포착하여 표준화된 JSON 오류 형식을 반환한다. 모든 성공 응답은 응답 인터셉터에 의해 일관된 엔벨로프로 래핑된다.

**Why this priority**: API 응답의 일관성은 이후 Feature에서의 프론트엔드 통합 및 API 소비자에게 필수적이다.

**Independent Test**: 존재하지 않는 엔드포인트를 호출하여 404를 트리거하고, 응답이 `{ statusCode, message, error }` 형식과 일치하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 존재하지 않는 엔드포인트에 대한 요청이 있을 때, **When** 서버가 이를 처리하면, **Then** 응답은 `{ "statusCode": 404, "message": "Cannot GET /unknown", "error": "Not Found" }`이다.
2. **Given** 엔드포인트가 `HttpException`을 throw할 때, **When** 예외 필터가 이를 처리하면, **Then** 응답에 올바른 상태 코드와 구조화된 JSON 오류 본문이 포함된다.
3. **Given** 임의의 엔드포인트에서 성공 응답이 있을 때, **When** 응답 인터셉터가 이를 처리하면, **Then** 응답 본문이 표준 엔벨로프 형식으로 래핑된다.

---

### Edge Cases

- PostgreSQL이 시작 시 접근 불가능하면 어떻게 되는가? 앱은 여전히 시작되어야 하지만(헬스 엔드포인트를 제공하기 위해), DB 의존 기능은 우아하게 실패한다.
- Redis가 다운 후 재연결되면 어떻게 되는가? `RedisService`는 ioredis 재시도 전략을 통해 자동 재연결해야 하며 헬스 상태가 `"up"`으로 복귀해야 한다.
- `.env` 파일이 완전히 없으면 어떻게 되는가? `@nestjs/config`가 프로세스 환경 변수로 폴백한다. 해당 변수도 없으면 유효성 검사가 실패한다.
- 이전에 `docker compose down` 없이 Docker Compose를 실행하면(고아 컨테이너) 어떻게 되는가? Compose가 이를 처리한다 — 기존 컨테이너가 재사용된다.
- 데이터베이스 포트가 다른 서비스에 의해 점유되어 있으면 어떻게 되는가? Docker Compose가 명확한 포트 바인딩 오류로 실패한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `apps/api`(백엔드 서버)와 `libs/common`(공유 모듈)을 포함하는 NestJS 모노레포 구조를 제공해야 한다(MUST).
- **FR-002**: 시스템은 마이그레이션 기반 스키마 관리를 통해 TypeORM으로 PostgreSQL에 연결해야 한다(MUST). Auto-sync는 개발 환경에서만 허용된다.
- **FR-003**: 시스템은 `ioredis`를 통해 Redis에 연결해야 한다(MUST). 연결 실패가 앱 시작을 방해해서는 안 된다(MUST NOT)(graceful degradation).
- **FR-004**: 시스템은 단일 `docker compose up -d` 명령으로 PostgreSQL과 Redis를 시작하는 `docker-compose.yml`을 제공해야 한다(MUST).
- **FR-005**: 시스템은 개별 구성요소 상태(DB, Redis)와 전체 상태를 JSON으로 반환하는 `GET /health`를 노출해야 한다(MUST).
- **FR-006**: 시스템은 `@nestjs/config`와 `class-validator`를 사용하여 시작 시 환경 변수를 검증해야 한다(MUST). 필수 변수 누락 시 명확한 오류 메시지와 함께 시작을 방지해야 한다(MUST).
- **FR-007**: 시스템은 `libs/common`에 공유 모듈을 제공해야 한다(MUST): 구조화된 JSON 로거, 글로벌 HTTP 예외 필터, 응답 인터셉터.

### Key Entities

- **AppConfig**: 키-값 설정 저장소. 속성: `id`(UUID), `key`(string, 환경별 고유), `value`(text), `environment`(string), `createdAt`, `updatedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run build`가 TypeScript 컴파일 오류 없이 완료된다.
- **SC-002**: PostgreSQL이 연결되었을 때 `GET /health`가 `db: "up"`을 반환한다.
- **SC-003**: Redis가 연결되었을 때 `GET /health`가 `redis: "up"`을 반환한다.
- **SC-004**: Redis가 중지된 상태에서 앱이 성공적으로 시작되고 `GET /health`가 `status: "degraded"`, `redis: "down"`을 반환한다.
- **SC-005**: `docker compose up -d`가 postgres와 redis 컨테이너를 시작하고, `curl localhost:3000/health`가 200을 반환한다.
- **SC-006**: 필수 환경 변수(`DATABASE_HOST`)를 제거하면 누락된 변수를 나열하는 오류 메시지와 함께 앱 시작이 실패한다.
- **SC-007**: 처리되지 않은 예외가 구조화된 JSON 오류 `{ statusCode, message, error }`를 반환한다.
- **SC-008**: `npm run migration:run`이 TypeORM 마이그레이션을 오류 없이 실행한다.

## Assumptions

- 개발자의 머신에 Node.js 20+가 설치되어 있다.
- 로컬 인프라를 위해 Docker와 Docker Compose v2를 사용할 수 있다.
- PostgreSQL 16과 Redis 7이 대상 버전이다.
- 개발 중에는 애플리케이션이 Docker 외부에서 실행되며(`nest start --watch`를 통한 핫 리로드), 인프라는 Docker에서 실행된다.
- CI/CD 파이프라인 구성은 F001 범위 밖이다.
- 인증 및 권한 부여는 F003으로 이관된다.
- 프로덕션 배포 구성(Kubernetes, 클라우드 서비스)은 범위 밖이다.

## Scope Boundaries

### In Scope
- NestJS 모노레포 구조 (`apps/api` + `libs/common`)
- PostgreSQL + Redis 연결 모듈
- Docker Compose 로컬 개발 환경
- 헬스 체크 엔드포인트, 환경 변수 관리, 공통 모듈 (로거, 필터, 인터셉터)

### Out of Scope
- 인증/권한 부여 (F003)
- LLM 게이트웨이 기능 (F002)
- CI/CD 파이프라인 구성
- 프로덕션 배포 설정
- 관리자 대시보드 (F007)
