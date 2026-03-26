# Research: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25
**Phase**: 0 (기술 리서치)

## 1. NestJS Monorepo vs Standalone

### Options Evaluated

| 기준 | Monorepo (`nest g app`) | Standalone |
|----------|------------------------|------------|
| 코드 공유 | `libs/`를 통한 네이티브 지원 — 공유 모듈, 엔티티, 타입 | 수동 npm 링킹 또는 복사-붙여넣기 |
| 빌드 파이프라인 | 프로젝트 참조를 사용한 단일 `nest build` | 서비스별 별도 빌드 |
| 확장성 | 구조 변경 없이 `apps/worker`, `apps/admin` 추가 가능 | 모노레포 또는 별도 저장소로의 마이그레이션 필요 |
| CI/CD 복잡도 | 중간 (선택적 빌드 가능) | 서비스별로는 단순, 교차 서비스는 복잡 |
| 개발자 온보딩 | 단일 저장소 클론, 단일 `npm install` | 관리해야 할 여러 저장소 |

### Decision: **NestJS Monorepo**

**Rationale**: AEGIS는 다중 모듈 플랫폼(API 게이트웨이, 관리자 대시보드, 워커)이다. 모노레포는 공유 엔티티(AppConfig, Provider, Model), 필터, 인터셉터, 설정 모듈을 위한 `libs/common`을 가능하게 한다. `apps/api` + `libs/common` 구조는 최소한의 오버헤드로 즉각적인 가치를 제공하면서 향후 `apps/worker`, `apps/admin`으로의 확장을 허용한다.

**Reference**: https://docs.nestjs.com/cli/monorepo

---

## 2. ORM: TypeORM vs Prisma vs MikroORM

### Options Evaluated

| 기준 | TypeORM | Prisma | MikroORM |
|----------|---------|--------|----------|
| NestJS 통합 | `@nestjs/typeorm` — 퍼스트 클래스 지원 | `@prisma/client` + 수동 모듈 | `@mikro-orm/nestjs` — 양호한 지원 |
| 마이그레이션 전략 | 코드 기반 + CLI 생성 | `prisma migrate`를 사용한 스키마 우선 | 코드 기반 + CLI |
| 엔티티 정의 | 데코레이터 기반 (TypeScript 클래스) | 스키마 파일 (`.prisma`) | 데코레이터 기반 (TypeScript 클래스) |
| 쿼리 빌더 | 내장, 유연함 | 제한적 (Prisma Client API) | 내장, QueryBuilder |
| Raw SQL 이스케이프 해치 | `query()`를 통해 용이 | `$queryRaw` | `em.execute()`를 통해 용이 |
| 커뮤니티 & 생태계 | 가장 크고, NestJS와 가장 많이 실전 검증됨 | 빠르게 성장 중, 현대적 DX | 작은 커뮤니티 |
| 런타임 오버헤드 | 중간 | 낮음 (생성된 클라이언트) | 중간 |
| 관계 처리 | Eager/lazy 로딩, 데코레이터 | includes를 통한 암시적 | Unit of Work 패턴 |

### Decision: **TypeORM**

**Rationale**:
1. **NestJS 퍼스트 클래스 통합**: `@nestjs/typeorm`은 NestJS 모듈 시스템에 자연스럽게 맞는 `TypeOrmModule.forRoot()`와 `TypeOrmModule.forFeature()`를 제공한다.
2. **데코레이터 기반 엔티티**: 엔티티 정의가 TypeScript 클래스와 함께 위치하여 AEGIS 도메인 엔티티 전반의 공유 패턴(타임스탬프, 소프트 삭제)에 대한 상속과 믹스인을 가능하게 한다.
3. **마이그레이션 유연성**: TypeORM은 자동 생성 마이그레이션(`typeorm migration:generate`)과 수동 작성 마이그레이션을 모두 지원하며, 이는 프로덕션 스키마 진화에 중요하다.
4. **실전 검증**: NestJS 프로젝트에서 가장 넓은 채택, 일반적인 패턴에 대한 광범위한 문서와 커뮤니티 솔루션.
5. **AEGIS 특화**: 향후 Feature(F002 LLM Gateway, F003 Auth)는 복잡한 관계(Provider -> Model, Tenant -> ApiKey)가 필요하다. TypeORM의 데코레이터 기반 관계 시스템(`@ManyToOne`, `@OneToMany`)이 이러한 도메인 모델에 자연스럽게 매핑된다.

**Trade-off acknowledged**: Prisma는 생성된 클라이언트로 더 나은 타입 안전성을 제공하고, MikroORM의 Unit of Work 패턴은 복잡한 트랜잭션에 더 깔끔하다. 하지만 TypeORM의 NestJS 생태계 통합과 데코레이터 기반 접근 방식이 모노레포 모듈 구조에 가장 잘 맞는다.

**Reference**: https://docs.nestjs.com/techniques/database

---

## 3. Redis Client: ioredis vs redis vs @nestjs/cache

### Options Evaluated

| 기준 | ioredis | redis (node-redis) | @nestjs/cache |
|----------|---------|-------------------|---------------|
| 연결 관리 | 자동 재연결, sentinels, cluster | 기본 재연결 | 추상화됨 (cache-manager) |
| API 스타일 | Promise 기반, 전체 Redis API | Promise 기반 (v4+) | get/set만 (캐시 추상화) |
| Pub/Sub 지원 | 네이티브, 퍼스트 클래스 | 지원됨 | 미지원 |
| Pipeline/Multi | 내장 | 지원됨 | 미지원 |
| Cluster 지원 | 네이티브 | 기본 | 미지원 |
| Lua scripting | 내장 | 지원됨 | 미지원 |
| TypeScript | 완전한 타이핑 | 완전한 타이핑 | 제한적 |
| 오류 처리 | 상세한 이벤트 (error, reconnecting, end) | 기본 이벤트 | 추상화됨 |

### Decision: **ioredis**

**Rationale**:
1. **전체 Redis API 접근**: AEGIS는 단순 캐싱 이상으로 Redis가 필요하다 — 속도 제한(F004 Token Budget), 실시간 카운터, 이벤트 스트리밍을 위한 pub/sub, 원자적 연산을 위한 Lua 스크립트.
2. **연결 복원력**: ioredis는 세밀한 재연결 전략, 연결 이벤트(`ready`, `reconnecting`, `error`, `end`)를 제공하여 graceful degradation(FR-003)을 가능하게 한다.
3. **Cluster 대비**: AEGIS가 프로덕션으로 확장될 때, ioredis는 코드 변경 없이 Redis Cluster와 Sentinel을 지원한다.
4. **직접 제어**: Redis를 `cache-manager` 뒤에 추상화하는 `@nestjs/cache`와 달리, ioredis는 특수한 데이터 구조(리더보드용 sorted sets, 로깅용 streams)에 필요한 직접 접근을 제공한다.

**Trade-off acknowledged**: `@nestjs/cache`가 기본 캐싱에는 더 간단하겠지만, AEGIS는 키-값 캐시 이상의 Redis 기능이 필요하다. ioredis를 커스텀 `RedisModule`과 `RedisService`로 래핑하면 편의성과 전체 기능을 모두 제공한다.

**Reference**: https://github.com/redis/ioredis

---

## 4. Docker Compose Configuration

### Decisions

| 구성요소 | 이미지 | 포트 | 근거 |
|-----------|-------|------|-----------|
| PostgreSQL | `postgres:16-alpine` | 5432 | 최신 LTS, 작은 이미지 크기를 위한 Alpine |
| Redis | `redis:7-alpine` | 6379 | 최신 안정 버전, Alpine 변형 |
| App | Node 20 (dev mode) | 3000 | Docker 외부에서 `npm run start:dev`로 실행하여 핫 리로드 |

### Key Configuration Decisions

1. **개발 시 앱은 Docker 외부에서 실행**: NestJS 앱을 호스트에서 직접 실행(Docker 내부가 아닌)하면 `nest start --watch`를 통한 빠른 핫 리로드가 가능하다. Docker Compose는 인프라(postgres, redis)만 관리한다.
2. **Named volumes**: PostgreSQL 데이터는 `docker compose down` 후에도 유지되도록 named volume `pgdata`를 통해 영구 저장된다.
3. **Health checks**: postgres와 redis 컨테이너 모두 준비 상태 확인을 위한 헬스 체크 설정을 포함한다.
4. **Network**: 로컬 개발에는 기본 bridge 네트워크로 충분하다. 서비스는 `localhost`를 통해 접근 가능하다.

---

## 5. Environment Variable Validation

### Approach: `@nestjs/config` + `class-validator`

**class-validator를 Joi나 Zod보다 선택한 이유**:
1. **일관성**: NestJS는 요청 파이프라인 전체에서 DTO 유효성 검사에 `class-validator`를 사용한다. 환경 변수 유효성 검사에도 같은 라이브러리를 사용하면 단일 유효성 검사 패러다임을 유지한다.
2. **데코레이터 패턴**: NestJS의 데코레이터 중심 아키텍처(`@IsString()`, `@IsNumber()`, `@IsOptional()`)와 일치한다.
3. **class-transformer 통합**: `plainToInstance()` + `validateSync()`가 부트스트랩 중 타입 변환(문자열 포트 -> 숫자)을 제공한다.
4. **Fail-fast**: 유효성 검사가 앱 부트스트랩 시 실행된다. 누락되거나 잘못된 환경 변수는 모든 위반 사항을 나열하는 명확한 오류 메시지와 함께 즉시 throw된다.

### Required Variables (F001)

| 변수 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|----------|---------|-------------|
| `DATABASE_HOST` | string | Yes | - | PostgreSQL 호스트 |
| `DATABASE_PORT` | number | Yes | 5432 | PostgreSQL 포트 |
| `DATABASE_USERNAME` | string | Yes | - | PostgreSQL 사용자명 |
| `DATABASE_PASSWORD` | string | Yes | - | PostgreSQL 비밀번호 |
| `DATABASE_NAME` | string | Yes | - | 데이터베이스 이름 |
| `REDIS_HOST` | string | Yes | localhost | Redis 호스트 |
| `REDIS_PORT` | number | Yes | 6379 | Redis 포트 |
| `PORT` | number | No | 3000 | 앱 수신 대기 포트 |
| `NODE_ENV` | string | No | development | 환경 이름 |

**Reference**: https://docs.nestjs.com/techniques/configuration

---

## 6. 선택된 스택 요약

| 계층 | 기술 | 버전 |
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
