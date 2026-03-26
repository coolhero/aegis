# Quickstart: F007 — Admin Dashboard

## Prerequisites

- Node.js 18+
- pnpm (monorepo package manager)
- apps/api 실행 중 (F001~F006 구현 완료)
- PostgreSQL + Redis 실행 중

## Setup

```bash
# 1. Next.js 앱 초기화 (apps/web)
cd apps/web
pnpm init
pnpm add next react react-dom
pnpm add -D typescript @types/react @types/node tailwindcss postcss autoprefixer

# 2. shadcn/ui 설정
npx shadcn-ui@latest init
# → Tailwind CSS, tailwind.config.ts, components.json 생성

# 3. 핵심 의존성 설치
pnpm add @tanstack/react-query recharts axios
pnpm add -D @playwright/test jest @testing-library/react @testing-library/jest-dom

# 4. shadcn/ui 컴포넌트 추가
npx shadcn-ui@latest add card table dialog form input button select badge tabs skeleton dropdown-menu separator
```

## Development

```bash
# API 서버 시작 (백엔드)
cd apps/api && npm run start:dev

# 프론트엔드 개발 서버
cd apps/web && pnpm dev
# → http://localhost:3001

# 테스트
pnpm test          # Jest unit tests
pnpm test:e2e      # Playwright E2E
```

## 환경 변수

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Demo

```bash
# 데모 실행
./demos/F007-admin-dashboard.sh
# → API + Web 서버 시작 → 브라우저 열기 → 로그인 안내
```
