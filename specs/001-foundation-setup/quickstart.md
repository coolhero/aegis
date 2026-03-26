# Quickstart: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25

## Prerequisites

| 도구 | 버전 | 확인 명령 |
|------|---------|---------------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |

## Setup

### 1. 레포지토리 클론

```bash
git clone <repository-url> aegis
cd aegis
```

### 2. 환경 변수 구성

```bash
cp .env.example .env
```

기본 `.env.example` 값은 Docker Compose 구성과 바로 호환된다. 로컬 개발 시 변경이 필요 없다.

### 3. 인프라 시작

```bash
docker compose up -d
```

다음이 시작된다:
- **PostgreSQL** — `localhost:5432`
- **Redis** — `localhost:6379`

### 4. 의존성 설치

```bash
npm install
```

### 5. 데이터베이스 마이그레이션 실행

```bash
npm run migration:run
```

### 6. 애플리케이션 시작

```bash
npm run start:dev
```

API 서버가 핫 리로드가 활성화된 상태로 `http://localhost:3000`에서 시작된다.

## Verify

### Health Check

```bash
curl http://localhost:3000/health
```

예상 응답:

```json
{
  "status": "ok",
  "components": {
    "db": "up",
    "redis": "up"
  },
  "timestamp": "2025-03-25T09:00:00.000Z"
}
```

### 데이터베이스 연결 확인

헬스 체크의 `components.db` 필드가 `"up"`이어야 한다. `"down"`으로 표시되면 PostgreSQL 컨테이너 로그를 확인한다:

```bash
docker compose logs postgres
```

### Redis 연결 확인

헬스 체크의 `components.redis` 필드가 `"up"`이어야 한다. `"down"`으로 표시되면 Redis 컨테이너 로그를 확인한다:

```bash
docker compose logs redis
```

## Common Issues

### 포트 5432가 이미 사용 중

다른 PostgreSQL 인스턴스가 기본 포트에서 실행 중이다.

```bash
# 프로세스 찾기
lsof -i :5432
# 프로세스를 중지하거나, .env와 docker-compose.yml에서 DATABASE_PORT를 변경
```

### 포트 6379가 이미 사용 중

다른 Redis 인스턴스가 기본 포트에서 실행 중이다.

```bash
# 프로세스 찾기
lsof -i :6379
# 프로세스를 중지하거나, .env와 docker-compose.yml에서 REDIS_PORT를 변경
```

### Docker 컨테이너가 시작되지 않음

```bash
# 컨테이너 상태 확인
docker compose ps

# 특정 서비스의 로그 보기
docker compose logs postgres
docker compose logs redis

# 모든 서비스 재시작
docker compose down && docker compose up -d
```

### 환경 변수 유효성 검사 실패

유효성 검사 오류로 앱 시작이 실패하면, `.env`에 모든 필수 변수가 설정되어 있는지 확인한다. `.env.example`을 참고한다.

```bash
diff .env .env.example
```

### TypeORM 마이그레이션 오류

```bash
# 마이그레이션 상태 확인
npm run migration:show

# 엔티티 변경 후 새 마이그레이션 생성
npm run migration:generate -- -n MigrationName

# 마지막 마이그레이션 되돌리기
npm run migration:revert
```

## 환경 중지

```bash
# 모든 컨테이너 중지 (데이터 보존)
docker compose stop

# 컨테이너 중지 및 제거 (볼륨을 통해 데이터 보존)
docker compose down

# 데이터를 포함하여 모든 것 중지 및 제거
docker compose down -v
```
