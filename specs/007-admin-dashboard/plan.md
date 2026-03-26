# Implementation Plan: F007 — Admin Dashboard

**Branch**: `007-admin-dashboard` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-admin-dashboard/spec.md`

## Summary

Next.js App Router 기반 관리 대시보드를 구현한다. shadcn/ui 컴포넌트 + Recharts 차트 + TanStack Query 데이터 페칭으로 구성. 프론트엔드 전용 Feature로 새 엔티티를 소유하지 않으며, F003/F004/F005의 REST API를 소비한다. SSE 실시간 스트림을 위한 백엔드 엔드포인트(`GET /events/stream`)를 NestJS에 추가한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), shadcn/ui, TanStack Query v5, Recharts 2.x, Tailwind CSS
**Storage**: N/A (프론트엔드 — 백엔드 API 소비)
**Testing**: Jest (unit), Playwright (E2E)
**Target Platform**: Web Browser (Chrome, Firefox, Safari, Edge)
**Project Type**: Web Application (Frontend + minimal Backend SSE endpoint)
**Performance Goals**: 페이지 초기 로딩 < 2s, 차트 업데이트 < 1s, SSE 이벤트 전달 < 1s
**Constraints**: MVP scope — 모바일(<768px) 제외, i18n 제외, 영어 UI 기본
**Scale/Scope**: 단일 조직 관리 (사용자 ~500, 팀 ~50)

## Constitution Check

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Tenant Data Isolation | ✅ | JWT의 orgId claim으로 테넌트 격리. 모든 API 호출에 Bearer token 포함 |
| Streaming-First | ✅ | SSE 기반 실시간 모니터링 |
| Secure Token Storage | ✅ | JWT는 httpOnly cookie 또는 메모리 저장. localStorage 사용 안 함 |
| Start Simple (YAGNI) | ✅ | MVP scope — 필수 기능만 구현 |
| Test-First | ✅ | 컴포넌트 unit test + E2E test |
| Demo-Ready Delivery | ✅ | 데모 스크립트로 서버 시작 + 브라우저 열기 |

## Project Structure

### Documentation (this feature)

```text
specs/007-admin-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (frontend types only)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── sse-events.contract.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/                          # Next.js App Router 프론트엔드
├── src/
│   ├── app/                       # App Router pages
│   │   ├── layout.tsx             # Root layout (sidebar + header)
│   │   ├── login/
│   │   │   └── page.tsx           # 로그인 페이지
│   │   └── dashboard/
│   │       ├── layout.tsx         # Dashboard layout (authenticated)
│   │       ├── page.tsx           # 메인 대시보드 (KPI cards)
│   │       ├── usage/
│   │       │   └── page.tsx       # 사용량/비용 차트
│   │       ├── budget/
│   │       │   └── page.tsx       # 예산 관리
│   │       ├── users/
│   │       │   └── page.tsx       # 사용자 관리
│   │       ├── api-keys/
│   │       │   └── page.tsx       # API Key 관리
│   │       ├── logs/
│   │       │   └── page.tsx       # 요청 로그
│   │       └── realtime/
│   │           └── page.tsx       # 실시간 모니터링
│   ├── components/                # 공유 UI 컴포넌트
│   │   ├── ui/                    # shadcn/ui 컴포넌트
│   │   ├── layout/
│   │   │   ├── sidebar.tsx        # 사이드바 네비게이션
│   │   │   ├── header.tsx         # 헤더 (사용자 메뉴)
│   │   │   └── page-header.tsx    # 페이지 제목 + breadcrumb
│   │   ├── charts/
│   │   │   ├── usage-line-chart.tsx
│   │   │   ├── cost-line-chart.tsx
│   │   │   ├── model-bar-chart.tsx
│   │   │   └── team-bar-chart.tsx
│   │   ├── budget/
│   │   │   ├── budget-gauge.tsx   # 사용률 게이지 바
│   │   │   └── budget-edit-modal.tsx
│   │   ├── data-table/
│   │   │   └── data-table.tsx     # 재사용 가능한 테이블 (페이지네이션, 필터)
│   │   └── states/
│   │       ├── loading-skeleton.tsx
│   │       ├── error-state.tsx
│   │       └── empty-state.tsx
│   ├── lib/
│   │   ├── api-client.ts          # Axios/fetch wrapper + JWT interceptor
│   │   ├── auth.ts                # 인증 컨텍스트 + 토큰 관리
│   │   ├── sse-client.ts          # SSE 연결 관리 + 재연결
│   │   └── query-keys.ts          # TanStack Query key 상수
│   ├── hooks/
│   │   ├── use-auth.ts            # 인증 훅 (로그인/로그아웃/역할 체크)
│   │   ├── use-budgets.ts         # 예산 CRUD 훅
│   │   ├── use-usage.ts           # 사용량/비용 데이터 훅
│   │   ├── use-users.ts           # 사용자 관리 훅
│   │   ├── use-api-keys.ts        # API Key 관리 훅
│   │   ├── use-logs.ts            # 로그 조회 훅
│   │   └── use-sse.ts             # SSE 이벤트 구독 훅
│   └── types/
│       └── api.ts                 # API 응답 타입 정의
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json

apps/api/src/events/               # NestJS SSE 백엔드 모듈
├── events.module.ts
├── events.controller.ts           # GET /events/stream SSE endpoint
├── events.gateway.ts              # 이벤트 발행 (BullMQ listener)
└── events.service.ts              # 테넌트별 SSE 연결 관리
```

**Structure Decision**: Next.js는 `apps/web/` 하위에 배치 (NestJS API는 기존 `apps/api/`). App Router의 파일 기반 라우팅으로 각 대시보드 페이지를 독립 route로 구성. SSE 백엔드는 NestJS의 events 모듈로 추가.

## Architecture

### 인증 플로우

```
Browser → POST /auth/login → JWT (access + refresh)
       → 모든 API 호출: Authorization: Bearer <accessToken>
       → 401 응답 → POST /auth/refresh → 새 토큰 → 원래 요청 재시도
       → refresh 실패 → /login 리다이렉트
```

### 데이터 페칭 전략

- **TanStack Query**: 모든 GET 요청은 useQuery로 관리
  - `staleTime`: 30초 (빈번한 업데이트가 필요한 사용량 데이터)
  - `refetchInterval`: 60초 (자동 리프레시)
  - `gcTime`: 5분 (가비지 컬렉션)
- **Mutations**: useMutation으로 PUT/POST/DELETE 관리 + optimistic update
- **SSE**: useSSE 커스텀 훅 → EventSource + 지수 백오프 재연결

### SSE 실시간 아키텍처

```
NestJS Backend:
  RequestLogger (F005) → BullMQ Event → EventsGateway → SSE Controller
                                                        ↓
Browser:                                               EventSource
  useSSE hook ← SSE events ← GET /events/stream?token=<JWT>
  → queryClient.invalidateQueries() → 차트/피드 업데이트
```

- 테넌트 격리: SSE 연결 시 JWT에서 orgId 추출 → 해당 org의 이벤트만 전달
- 재연결: 지수 백오프 (1s, 2s, 4s, 8s, max 30s) + jitter
- Keep-alive: 30초 간격 heartbeat (`event: ping`)

### RBAC UI 제어

| 역할 | 대시보드 | 예산 | 사용자 관리 | API Keys | 로그 | 실시간 |
|------|---------|------|-----------|----------|------|--------|
| admin | 전체 | CRUD | CRUD | CRUD | 조회 | 조회 |
| member | 조회 | 조회 | — | 자기 키만 | 조회 | 조회 |
| viewer | 조회 | 조회 | — | — | 조회 | 조회 |

## Interaction Chains

| FR | User Action | Handler | Store Mutation | DOM Effect | Visual Result | Verify Method |
|----|-------------|---------|---------------|------------|---------------|---------------|
| FR-001 | Submit login form | onLogin(email, pwd) | auth.token=jwt, auth.user=user | redirect to /dashboard | Dashboard page loads | verify-state /dashboard rendered |
| FR-002 | Page load with viewer role | RoleGuard check | — | admin buttons hidden | Edit/Create buttons not visible | verify-state .admin-action hidden |
| FR-003 | Select period "This Month" | onPeriodChange('month') | usage.period='month' | Chart re-renders with monthly data | Line chart updates | verify-effect .usage-chart data updated |
| FR-005 | Click budget edit → save | onBudgetSave(data) | budget.current=updated | Modal closes, gauge updates | Gauge bar reflects new limit | verify-effect .budget-gauge value updated |
| FR-007 | Click "Create API Key" | onCreateKey(name, scopes) | apiKeys.list=[...list, newKey] | Modal shows full key | Key displayed once with warning | verify-state .api-key-modal visible |
| FR-008 | async-flow: SSE connected | onSSEOpen() | sse.status='connected' | .status-dot green | Green connection indicator | verify-state .sse-indicator.connected |
| FR-008 | async-flow: New event | onSSEMessage(event) | realtime.feed=[event, ...feed] | Activity feed prepended | New entry at top of feed | verify-effect .activity-feed firstChild updated |
| FR-009 | async-flow: SSE disconnected | onSSEError() | sse.status='reconnecting' | .status-dot red, backoff timer | Red indicator + retry count | verify-state .sse-indicator.disconnected |
| FR-009 | async-flow: SSE reconnected | onSSEReconnect() | sse.status='connected' | .status-dot green | Green indicator restored | verify-state .sse-indicator.connected |
| FR-011 | async-flow: Data loading | query starts | isLoading=true | Skeleton UI visible | Shimmer placeholders | verify-state .skeleton visible |
| FR-011 | async-flow: Data error | query error | isError=true | Error state visible | Error message + retry button | verify-state .error-state visible |
| FR-011 | async-flow: Empty data | query success, data=[] | isEmpty=true | Empty state visible | Guide message shown | verify-state .empty-state visible |
| FR-013 | Click sidebar nav item | router.push(path) | — | Page transition | New page content loads | verify-state pathname matches |

## Supplementary API: PATCH /users/:id

F003의 사용자 수정 API가 미구현되어 F007에서 보조 구현한다.

- **위치**: `apps/api/src/auth/organization.controller.ts` (기존 F003 컨트롤러에 추가)
- **엔드포인트**: `PATCH /users/:id`
- **Auth**: JwtAuthGuard + Admin 역할 체크
- **Body**: `{ role?: string, teamId?: string | null }`
- **구현**: User 엔티티의 `role`과 `team_id` 필드를 업데이트
- **테넌트 격리**: 요청자의 orgId와 대상 사용자의 org_id가 일치해야 함

## Complexity Tracking

No constitution violations. All decisions follow YAGNI / Start Simple.
