# Feature Specification: F001 — Foundation Setup

**Feature Branch**: `001-foundation-setup`
**Created**: 2025-03-25
**Status**: Implemented
**Input**: AEGIS platform foundation infrastructure — NestJS monorepo, PostgreSQL, Redis, Docker Compose, health check, env management

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Local Environment (Priority: P1)

A backend developer joins the AEGIS project and needs to stand up the entire development environment with minimal steps. They clone the repo, run `docker compose up -d` and `npm run start:dev`, and have a fully working local stack with PostgreSQL, Redis, and the NestJS API server.

**Why this priority**: Without a working local environment, no other feature can be developed or tested. This is the absolute foundation.

**Independent Test**: Run `docker compose up -d && npm install && npm run start:dev`, then `curl localhost:3000/health` returns 200 with `status: "ok"`.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** the developer runs `cp .env.example .env && docker compose up -d && npm install && npm run start:dev`, **Then** the NestJS application starts without errors and listens on port 3000.
2. **Given** the application is running, **When** the developer sends `GET /health`, **Then** the response is `200 OK` with `{ "status": "ok", "components": { "db": "up", "redis": "up" } }`.
3. **Given** the Docker Compose file, **When** `docker compose up -d` is executed, **Then** PostgreSQL (port 5432) and Redis (port 6379) containers are running and healthy.

---

### User Story 2 - Health Monitoring (Priority: P2)

A DevOps engineer needs to monitor the health of the AEGIS API and its dependencies. The `GET /health` endpoint reports the individual status of each infrastructure component (DB, Redis) and an overall status, enabling integration with monitoring dashboards and load balancer health checks.

**Why this priority**: Health monitoring is critical for production readiness and debugging infrastructure issues during development.

**Independent Test**: Start the app, stop Redis, verify `/health` returns `"degraded"`. Stop PostgreSQL, verify `/health` returns 503.

**Acceptance Scenarios**:

1. **Given** all infrastructure is healthy, **When** `GET /health` is called, **Then** response is `200` with `status: "ok"`, `db: "up"`, `redis: "up"`.
2. **Given** Redis is stopped but PostgreSQL is running, **When** `GET /health` is called, **Then** response is `200` with `status: "degraded"`, `db: "up"`, `redis: "down"`.
3. **Given** PostgreSQL is stopped, **When** `GET /health` is called, **Then** response is `503` with `status: "error"`, `db: "down"`.
4. **Given** both PostgreSQL and Redis are stopped, **When** `GET /health` is called, **Then** response is `503` with `status: "error"`, `db: "down"`, `redis: "down"`.

---

### User Story 3 - Fail-Fast Environment Validation (Priority: P3)

A developer misconfigures their `.env` file (missing required variables or invalid values). The application must refuse to start immediately with a clear, actionable error message listing all invalid/missing variables, rather than failing at runtime with cryptic connection errors.

**Why this priority**: Prevents debugging time wasted on runtime errors caused by misconfiguration. Improves developer experience.

**Independent Test**: Remove `DATABASE_HOST` from `.env`, run `npm run start:dev`, verify it fails immediately with a message mentioning the missing variable.

**Acceptance Scenarios**:

1. **Given** `.env` is missing `DATABASE_HOST`, **When** the app starts, **Then** it fails immediately with an error message containing `"DATABASE_HOST"`.
2. **Given** `.env` has `DATABASE_PORT=not_a_number`, **When** the app starts, **Then** it fails immediately with a validation error for `DATABASE_PORT`.
3. **Given** all required variables are present and valid, **When** the app starts, **Then** it boots successfully without validation errors.

---

### User Story 4 - Common Error Handling (Priority: P4)

The API returns consistent, structured error responses across all endpoints. When an unhandled exception occurs, the global exception filter catches it and returns a standardized JSON error format. All successful responses are wrapped in a consistent envelope by the response interceptor.

**Why this priority**: Consistency in API responses is essential for frontend integration and API consumers in later features.

**Independent Test**: Trigger a 404 by calling a non-existent endpoint, verify the response matches `{ statusCode, message, error }` format.

**Acceptance Scenarios**:

1. **Given** a request to a non-existent endpoint, **When** the server processes it, **Then** the response is `{ "statusCode": 404, "message": "Cannot GET /unknown", "error": "Not Found" }`.
2. **Given** an endpoint throws an `HttpException`, **When** the exception filter processes it, **Then** the response has the correct status code and structured JSON error body.
3. **Given** a successful response from any endpoint, **When** the response interceptor processes it, **Then** the response body is wrapped in the standard envelope format.

---

### Edge Cases

- What happens when PostgreSQL is unreachable at startup? App should still start (to serve health endpoint), but DB-dependent features fail gracefully.
- What happens when Redis reconnects after being down? `RedisService` should auto-reconnect via ioredis retry strategy and health status should return to `"up"`.
- What happens when `.env` file is completely missing? `@nestjs/config` falls back to process environment variables. If those are also missing, validation fails.
- What happens when Docker Compose is run without prior `docker compose down` (orphan containers)? Compose handles this — existing containers are reused.
- What happens when the database port is occupied by another service? Docker Compose fails with a clear port-binding error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a NestJS monorepo structure with `apps/api` (backend server) and `libs/common` (shared modules).
- **FR-002**: System MUST connect to PostgreSQL via TypeORM with migration-based schema management. Auto-sync is allowed only in development.
- **FR-003**: System MUST connect to Redis via `ioredis`. Connection failure MUST NOT prevent app startup (graceful degradation).
- **FR-004**: System MUST provide a `docker-compose.yml` that starts PostgreSQL and Redis with a single `docker compose up -d` command.
- **FR-005**: System MUST expose `GET /health` returning individual component status (DB, Redis) and overall status as JSON.
- **FR-006**: System MUST validate environment variables at startup using `@nestjs/config` and `class-validator`. Missing required variables MUST prevent startup with clear error messages.
- **FR-007**: System MUST provide shared modules in `libs/common`: structured JSON logger, global HTTP exception filter, response interceptor.

### Key Entities

- **AppConfig**: Key-value configuration store. Attributes: `id` (UUID), `key` (string, unique per environment), `value` (text), `environment` (string), `createdAt`, `updatedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run build` completes without TypeScript compilation errors.
- **SC-002**: `GET /health` returns `db: "up"` when PostgreSQL is connected.
- **SC-003**: `GET /health` returns `redis: "up"` when Redis is connected.
- **SC-004**: With Redis stopped, app starts successfully and `GET /health` returns `status: "degraded"`, `redis: "down"`.
- **SC-005**: `docker compose up -d` starts postgres and redis containers; `curl localhost:3000/health` returns 200.
- **SC-006**: Removing required env vars (`DATABASE_HOST`) causes app startup failure with an error message listing the missing variable.
- **SC-007**: Unhandled exceptions return structured JSON error `{ statusCode, message, error }`.
- **SC-008**: `npm run migration:run` executes TypeORM migrations without errors.

## Assumptions

- Node.js 20+ is installed on the developer's machine.
- Docker and Docker Compose v2 are available for local infrastructure.
- PostgreSQL 16 and Redis 7 are the target versions.
- The application runs outside Docker during development (hot-reload via `nest start --watch`), while infrastructure runs in Docker.
- CI/CD pipeline configuration is out of scope for F001.
- Authentication and authorization are deferred to F003.
- Production deployment configuration (Kubernetes, cloud services) is out of scope.

## Scope Boundaries

### In Scope
- NestJS monorepo structure (`apps/api` + `libs/common`)
- PostgreSQL + Redis connection modules
- Docker Compose local development environment
- Health check endpoint, environment variable management, common modules (logger, filter, interceptor)

### Out of Scope
- Authentication/authorization (F003)
- LLM gateway functionality (F002)
- CI/CD pipeline configuration
- Production deployment setup
- Admin dashboard (F007)
