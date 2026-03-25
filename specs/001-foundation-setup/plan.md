# Plan: F001 — Foundation Setup

## Architecture Overview

NestJS monorepo 구조로 `apps/api` (메인 서버)와 `libs/common` (공유 모듈)을 구성. TypeORM으로 PostgreSQL, ioredis로 Redis에 연결. Docker Compose로 로컬 개발 환경 제공.

## Data Model

### AppConfig Entity (owner: F001)
```typescript
@Entity()
export class AppConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column('text')
  value: string;

  @Column({ default: 'default' })
  environment: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

## Project Structure

```
aegis/
├── apps/
│   └── api/
│       └── src/
│           ├── main.ts                 # Bootstrap
│           ├── app.module.ts           # Root module
│           └── health/
│               ├── health.controller.ts
│               └── health.module.ts
├── libs/
│   └── common/
│       └── src/
│           ├── config/
│           │   ├── config.module.ts
│           │   └── env.validation.ts
│           ├── database/
│           │   ├── database.module.ts
│           │   └── migrations/
│           ├── redis/
│           │   ├── redis.module.ts
│           │   └── redis.service.ts
│           ├── filters/
│           │   └── http-exception.filter.ts
│           ├── interceptors/
│           │   └── response.interceptor.ts
│           └── logger/
│               └── logger.service.ts
├── docker-compose.yml
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

## Implementation Phases

### Phase 1: Project Scaffolding
- NestJS monorepo 초기화 (nest-cli.json, tsconfig paths)
- package.json 의존성 정의
- Docker Compose 파일

### Phase 2: Core Modules
- ConfigModule (환경변수 검증)
- DatabaseModule (TypeORM + PostgreSQL)
- RedisModule (ioredis + graceful degradation)

### Phase 3: Common Utilities
- Logger (structured JSON)
- HttpExceptionFilter
- ResponseInterceptor

### Phase 4: Health Check
- HealthController with DB + Redis checks
- Individual + overall status

## Dependencies
- `@nestjs/core`, `@nestjs/common`, `@nestjs/config`
- `@nestjs/typeorm`, `typeorm`, `pg`
- `ioredis`
- `class-validator`, `class-transformer`
