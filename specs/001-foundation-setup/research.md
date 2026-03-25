# Research: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25
**Phase**: 0 (Technology Research)

## 1. NestJS Monorepo vs Standalone

### Options Evaluated

| Criteria | Monorepo (`nest g app`) | Standalone |
|----------|------------------------|------------|
| Code sharing | Native via `libs/` — shared modules, entities, types | Manual npm linking or copy-paste |
| Build pipeline | Single `nest build` with project references | Separate builds per service |
| Scalability | Add `apps/worker`, `apps/admin` later without restructuring | Requires migration to monorepo or separate repos |
| CI/CD complexity | Moderate (selective builds possible) | Simple per-service, complex cross-service |
| Developer onboarding | One repo clone, one `npm install` | Multiple repos to manage |

### Decision: **NestJS Monorepo**

**Rationale**: AEGIS is a multi-module platform (API gateway, admin dashboard, workers). Monorepo enables `libs/common` for shared entities (AppConfig, Provider, Model), filters, interceptors, and config modules. The `apps/api` + `libs/common` structure provides immediate value with minimal overhead while allowing future expansion to `apps/worker`, `apps/admin`.

**Reference**: https://docs.nestjs.com/cli/monorepo

---

## 2. ORM: TypeORM vs Prisma vs MikroORM

### Options Evaluated

| Criteria | TypeORM | Prisma | MikroORM |
|----------|---------|--------|----------|
| NestJS integration | `@nestjs/typeorm` — first-class support | `@prisma/client` + manual module | `@mikro-orm/nestjs` — good support |
| Migration strategy | Code-based + CLI generation | Schema-first with `prisma migrate` | Code-based + CLI |
| Entity definition | Decorator-based (TypeScript classes) | Schema file (`.prisma`) | Decorator-based (TypeScript classes) |
| Query builder | Built-in, flexible | Limited (Prisma Client API) | Built-in, QueryBuilder |
| Raw SQL escape hatch | Easy via `query()` | `$queryRaw` | Easy via `em.execute()` |
| Community & ecosystem | Largest, most battle-tested with NestJS | Growing fast, modern DX | Smaller community |
| Runtime overhead | Moderate | Low (generated client) | Moderate |
| Relation handling | Eager/lazy loading, decorators | Implicit via includes | Unit of Work pattern |

### Decision: **TypeORM**

**Rationale**:
1. **NestJS first-class integration**: `@nestjs/typeorm` provides `TypeOrmModule.forRoot()` and `TypeOrmModule.forFeature()` which fit naturally into NestJS module system.
2. **Decorator-based entities**: Entity definitions colocate with TypeScript classes, enabling inheritance and mixins for shared patterns (timestamps, soft-delete) across AEGIS domain entities.
3. **Migration flexibility**: TypeORM supports both auto-generated migrations (`typeorm migration:generate`) and hand-written migrations, critical for production schema evolution.
4. **Battle-tested**: Widest adoption in NestJS projects, extensive documentation and community solutions for common patterns.
5. **AEGIS-specific**: Future features (F002 LLM Gateway, F003 Auth) need complex relations (Provider -> Model, Tenant -> ApiKey). TypeORM's decorator-based relation system (`@ManyToOne`, `@OneToMany`) maps naturally to these domain models.

**Trade-off acknowledged**: Prisma offers better type safety with its generated client, and MikroORM's Unit of Work pattern is cleaner for complex transactions. However, TypeORM's NestJS ecosystem integration and decorator-based approach align best with the monorepo module structure.

**Reference**: https://docs.nestjs.com/techniques/database

---

## 3. Redis Client: ioredis vs redis vs @nestjs/cache

### Options Evaluated

| Criteria | ioredis | redis (node-redis) | @nestjs/cache |
|----------|---------|-------------------|---------------|
| Connection management | Auto-reconnect, sentinels, cluster | Basic reconnect | Abstracted (cache-manager) |
| API style | Promise-based, full Redis API | Promise-based (v4+) | get/set only (cache abstraction) |
| Pub/Sub support | Native, first-class | Supported | Not supported |
| Pipeline/Multi | Built-in | Supported | Not supported |
| Cluster support | Native | Basic | Not supported |
| Lua scripting | Built-in | Supported | Not supported |
| TypeScript | Full typings | Full typings | Limited |
| Error handling | Detailed events (error, reconnecting, end) | Basic events | Abstracted |

### Decision: **ioredis**

**Rationale**:
1. **Full Redis API access**: AEGIS needs Redis beyond simple caching — rate limiting (F004 Token Budget), real-time counters, pub/sub for event streaming, and Lua scripts for atomic operations.
2. **Connection resilience**: ioredis provides fine-grained reconnect strategies, connection events (`ready`, `reconnecting`, `error`, `end`), enabling graceful degradation (FR-003).
3. **Cluster-ready**: When AEGIS scales to production, ioredis supports Redis Cluster and Sentinel without code changes.
4. **Direct control**: Unlike `@nestjs/cache` which abstracts Redis behind `cache-manager`, ioredis gives direct access needed for specialized data structures (sorted sets for leaderboards, streams for logging).

**Trade-off acknowledged**: `@nestjs/cache` would be simpler for basic caching, but AEGIS requires Redis features beyond key-value cache. Wrapping ioredis in a custom `RedisModule` with `RedisService` provides both convenience and full capability.

**Reference**: https://github.com/redis/ioredis

---

## 4. Docker Compose Configuration

### Decisions

| Component | Image | Port | Rationale |
|-----------|-------|------|-----------|
| PostgreSQL | `postgres:16-alpine` | 5432 | Latest LTS, Alpine for small image size |
| Redis | `redis:7-alpine` | 6379 | Latest stable, Alpine variant |
| App | Node 20 (dev mode) | 3000 | Runs via `npm run start:dev` outside Docker for hot reload |

### Key Configuration Decisions

1. **App outside Docker for dev**: Running the NestJS app directly on host (not in Docker) enables fast hot-reload via `nest start --watch`. Docker Compose manages only infrastructure (postgres, redis).
2. **Named volumes**: PostgreSQL data persisted via named volume `pgdata` to survive `docker compose down`.
3. **Health checks**: Both postgres and redis containers include health check configs for readiness verification.
4. **Network**: Default bridge network sufficient for local dev. Services accessible via `localhost`.

---

## 5. Environment Variable Validation

### Approach: `@nestjs/config` + `class-validator`

**Why class-validator over Joi or Zod**:
1. **Consistency**: NestJS uses `class-validator` for DTO validation throughout the request pipeline. Using the same library for env validation maintains a single validation paradigm.
2. **Decorator pattern**: Matches NestJS's decorator-heavy architecture (`@IsString()`, `@IsNumber()`, `@IsOptional()`).
3. **class-transformer integration**: `plainToInstance()` + `validateSync()` provides type coercion (string port -> number) during bootstrap.
4. **Fail-fast**: Validation runs at app bootstrap. Missing or invalid env vars throw immediately with clear error messages listing all violations.

### Required Variables (F001)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DATABASE_HOST` | string | Yes | - | PostgreSQL host |
| `DATABASE_PORT` | number | Yes | 5432 | PostgreSQL port |
| `DATABASE_USERNAME` | string | Yes | - | PostgreSQL username |
| `DATABASE_PASSWORD` | string | Yes | - | PostgreSQL password |
| `DATABASE_NAME` | string | Yes | - | Database name |
| `REDIS_HOST` | string | Yes | localhost | Redis host |
| `REDIS_PORT` | number | Yes | 6379 | Redis port |
| `PORT` | number | No | 3000 | App listen port |
| `NODE_ENV` | string | No | development | Environment name |

**Reference**: https://docs.nestjs.com/techniques/configuration

---

## 6. Summary of Chosen Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20+ |
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x |
| ORM | TypeORM | 0.3.x |
| Database | PostgreSQL | 16 |
| Cache/Store | Redis (via ioredis) | 7.x |
| Env Validation | class-validator + class-transformer | Latest |
| Containerization | Docker Compose | v2 |
| Package Manager | npm | 10+ |
