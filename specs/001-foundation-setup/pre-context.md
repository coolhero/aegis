# Pre-Context: F001 — Foundation Setup

## Feature Summary
NestJS 모노레포 기반 프로젝트 초기 설정. PostgreSQL, Redis, Docker Compose 환경 구성과 헬스체크 엔드포인트, 환경변수 관리를 포함한다.

## User & Purpose
- **Actor(s)**: DevOps 엔지니어, 백엔드 개발자
- **Problem**: AEGIS 플랫폼의 모든 Feature가 공유하는 인프라 기반이 없음
- **Key Scenarios**: 로컬 개발 환경 `docker compose up` 원커맨드 기동, CI/CD 파이프라인 헬스체크, 환경별(dev/staging/prod) 설정 분리

## Capabilities
- NestJS monorepo 프로젝트 구조 (apps/ + libs/)
- PostgreSQL 데이터베이스 연결 및 마이그레이션 (TypeORM)
- Redis 연결 (캐시, 세션, 실시간 카운터용)
- Docker Compose 로컬 개발 환경 (postgres, redis, app)
- `GET /health` 엔드포인트 (DB + Redis connectivity check)
- 환경변수 관리 (`@nestjs/config`, `.env` + validation)
- 공통 모듈: Logger, Exception Filter, Response Interceptor

## Data Ownership
- **Owns**: AppConfig (환경 설정 엔티티)
- **References**: 없음 (최하위 의존성)

## Interfaces
- **Provides**: `GET /health` (헬스체크), 공통 NestJS 모듈 (ConfigModule, DatabaseModule, RedisModule)
- **Consumes**: 없음

## Dependencies
- 없음 (Tier 0 — 모든 Feature의 기반)

## Domain-Specific Notes
- **ai-gateway Archetype A4**: Tenant context 전파를 위한 미들웨어 패턴의 기반을 이 Feature에서 설정
- ConfigModule은 provider credentials, budget 설정 등 후속 Feature의 설정도 수용 가능하게 확장 가능한 구조로 설계

## For /speckit.specify
- Foundation Feature이므로 비즈니스 로직 SC는 최소화. 인프라 안정성 SC에 집중.
- SC 필수: Docker Compose 환경에서 postgres/redis 미기동 시 app 기동 실패 처리, 헬스체크 각 컴포넌트 개별 상태 반환
- TypeORM 마이그레이션 전략 명시 (auto-sync vs migration file)
- Redis 연결 실패 시 graceful degradation 여부 결정 필요
