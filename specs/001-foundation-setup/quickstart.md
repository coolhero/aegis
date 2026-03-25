# Quickstart: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25

## Prerequisites

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url> aegis
cd aegis
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

The default `.env.example` values work with the Docker Compose configuration out of the box. No changes needed for local development.

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Database Migrations

```bash
npm run migration:run
```

### 6. Start the Application

```bash
npm run start:dev
```

The API server starts on `http://localhost:3000` with hot-reload enabled.

## Verify

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

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

### Verify Database Connection

The health check `components.db` field should show `"up"`. If it shows `"down"`, check PostgreSQL container logs:

```bash
docker compose logs postgres
```

### Verify Redis Connection

The health check `components.redis` field should show `"up"`. If it shows `"down"`, check Redis container logs:

```bash
docker compose logs redis
```

## Common Issues

### Port 5432 Already in Use

Another PostgreSQL instance is running on the default port.

```bash
# Find the process
lsof -i :5432
# Stop it, or change DATABASE_PORT in .env and docker-compose.yml
```

### Port 6379 Already in Use

Another Redis instance is running on the default port.

```bash
# Find the process
lsof -i :6379
# Stop it, or change REDIS_PORT in .env and docker-compose.yml
```

### Docker Containers Not Starting

```bash
# Check container status
docker compose ps

# View logs for a specific service
docker compose logs postgres
docker compose logs redis

# Restart all services
docker compose down && docker compose up -d
```

### Environment Variable Validation Failure

If the app fails to start with a validation error, ensure all required variables are set in `.env`. Compare with `.env.example` for reference.

```bash
diff .env .env.example
```

### TypeORM Migration Errors

```bash
# Check migration status
npm run migration:show

# Generate a new migration after entity changes
npm run migration:generate -- -n MigrationName

# Revert the last migration
npm run migration:revert
```

## Stopping the Environment

```bash
# Stop all containers (preserves data)
docker compose stop

# Stop and remove containers (preserves data via volumes)
docker compose down

# Stop and remove everything including data
docker compose down -v
```
