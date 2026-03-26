# Tasks: F007 — Admin Dashboard

**Feature**: F007 — Admin Dashboard
**Branch**: `007-admin-dashboard`
**Generated**: 2026-03-26
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Implementation Strategy

- **MVP**: Phase 1 (Setup) + Phase 2 (Foundation) + Phase 3 (US1 Login+Main) + Phase 4 (US2 Usage)
- **Full**: + Phase 5-8 (US3-US6) + Phase 9 (Polish)
- **Parallel**: 태스크 내 [P] 표시된 항목은 동시 실행 가능

## Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1) → Phase 4-8 (US2-US6, 일부 병렬) → Phase 9 (Polish)
```

- US1 (Login+Main): 기반 — 모든 후속 US의 전제
- US2 (Usage): US1 이후
- US3 (Budget): US1 이후 (US2와 병렬 가능)
- US4 (Users/API Keys): US1 이후 (US2/US3와 병렬 가능)
- US5 (SSE Realtime): US1 이후 + 백엔드 SSE 엔드포인트 필요
- US6 (Logs): US1 이후 (US2/US3/US4와 병렬 가능)

---

## Phase 1: Setup

- [ ] T001 Next.js 앱 초기화 — `apps/web/` 디렉토리에 Next.js App Router 프로젝트 생성 (package.json, tsconfig.json, next.config.js, tailwind.config.ts)
- [ ] T002 shadcn/ui 초기화 — `apps/web/`에서 `npx shadcn-ui@latest init` + 핵심 컴포넌트 설치 (Card, Table, Dialog, Form, Input, Button, Select, Badge, Tabs, Skeleton, DropdownMenu, Separator)
- [ ] T003 핵심 의존성 설치 — @tanstack/react-query, recharts, axios 설치. `apps/web/package.json` 업데이트
- [ ] T004 monorepo 통합 — 루트 `package.json`에 `apps/web` 워크스페이스 추가. API 프록시 설정 (`next.config.js`에서 `/api` → `http://localhost:3000` rewrite)

---

## Phase 2: Foundation (공통 인프라)

- [ ] T005 [P] API 클라이언트 생성 — `apps/web/src/lib/api-client.ts`: Axios 인스턴스 + JWT Bearer 토큰 interceptor + 401 자동 refresh 로직
- [ ] T006 [P] 인증 컨텍스트 생성 — `apps/web/src/lib/auth.ts`: AuthProvider (React Context), 토큰 메모리 저장, login/logout/refresh 함수
- [ ] T007 [P] TanStack Query 설정 — `apps/web/src/lib/query-keys.ts`: 쿼리 키 상수. `apps/web/src/app/providers.tsx`: QueryClientProvider 설정 (staleTime=30s, gcTime=5min)
- [ ] T008 [P] 공통 타입 정의 — `apps/web/src/types/api.ts`: AuthUser, Budget, BudgetPeriod, UsageDataPoint, ModelBreakdown, TeamBreakdown, RequestLogEntry, PaginatedResponse 등 TypeScript 인터페이스
- [ ] T009 [P] 공통 UI 컴포넌트 — `apps/web/src/components/states/loading-skeleton.tsx`, `error-state.tsx`, `empty-state.tsx`: 로딩/에러/빈 상태 컴포넌트
- [ ] T010 대시보드 레이아웃 — `apps/web/src/app/layout.tsx`: Root layout. `apps/web/src/app/dashboard/layout.tsx`: Authenticated layout (사이드바 + 헤더). `apps/web/src/components/layout/sidebar.tsx`: Dashboard, Usage, Budget, Users, API Keys, Logs, Realtime 네비게이션. `apps/web/src/components/layout/header.tsx`: 사용자 메뉴 + 로그아웃. RBAC에 따른 메뉴 가시성
- [ ] T011 useAuth 훅 — `apps/web/src/hooks/use-auth.ts`: useAuth() 커스텀 훅 — login, logout, user, isAdmin, canEdit 등 유틸리티
- [ ] T012 Next.js 미들웨어 — `apps/web/src/middleware.ts`: JWT 검증 → 미인증 시 `/login` 리다이렉트. `/dashboard/*` 경로 보호

---

## Phase 3: US1 — 대시보드 로그인 및 메인 화면 (P1)

**Goal**: 로그인 → 메인 대시보드 진입 → KPI 카드 렌더링
**Independent Test**: 이메일/비밀번호 로그인 → 대시보드 메인 표시 → 미인증 리다이렉트

- [ ] T013 [US1] 로그인 페이지 — `apps/web/src/app/login/page.tsx`: 이메일/비밀번호 폼 + 제출 → POST /auth/login → 성공 시 /dashboard 리다이렉트. 에러 시 에러 메시지 표시
- [ ] T014 [US1] 메인 대시보드 페이지 — `apps/web/src/app/dashboard/page.tsx`: KPI 카드 4개 (총 사용량, 총 비용, 활성 사용자 수, 오늘 요청 수). `GET /usage/summary` + `GET /users` 데이터로 렌더링
- [ ] T015 [US1] RBAC UI 제어 — viewer 역할: 사이드바 관리 메뉴 숨김 or 비활성화, 편집 버튼 숨김. `useAuth().canEdit()` 조건부 렌더링
- [ ] T016 [US1] 토큰 자동 갱신 — `apps/web/src/lib/api-client.ts`: 401 응답 시 refresh queue 패턴 (동시 요청 race condition 방지). refresh 실패 시 /login 리다이렉트

---

## Phase 4: US2 — 사용량 및 비용 대시보드 (P1)

**Goal**: 기간별/모델별/팀별 사용량/비용 차트 시각화
**Independent Test**: Usage 페이지 → 기간 선택 → 차트 렌더링 → 팀별/모델별 breakdown

- [ ] T017 [P] [US2] useUsage 훅 — `apps/web/src/hooks/use-usage.ts`: useUsageChart(period), useModelBreakdown(period), useTeamBreakdown(period) — TanStack Query 기반
- [ ] T018 [P] [US2] 사용량 line chart — `apps/web/src/components/charts/usage-line-chart.tsx`: Recharts LineChart — 일별 토큰 사용량 트렌드
- [ ] T019 [P] [US2] 비용 line chart — `apps/web/src/components/charts/cost-line-chart.tsx`: Recharts LineChart — 일별 비용 트렌드
- [ ] T020 [P] [US2] 모델별 bar chart — `apps/web/src/components/charts/model-bar-chart.tsx`: Recharts BarChart — 모델별 토큰 사용량 + 비율(%)
- [ ] T021 [P] [US2] 팀별 bar chart — `apps/web/src/components/charts/team-bar-chart.tsx`: Recharts BarChart — 팀별 비용 비교 + 순위
- [ ] T022 [US2] Usage 페이지 — `apps/web/src/app/dashboard/usage/page.tsx`: 기간 선택기 (Last 7 Days, This Month, Last 3 Months) + Tabs (Overview, Model Breakdown, Team Breakdown) + 차트 조합. Empty state 처리

---

## Phase 5: US3 — 예산 관리 UI (P1)

**Goal**: Org/Team/User 예산 조회/설정/수정 UI
**Independent Test**: Budget 페이지 → Org 예산 편집 → Team 목록 → 임계치 설정

- [ ] T023 [P] [US3] useBudgets 훅 — `apps/web/src/hooks/use-budgets.ts`: useBudget(level, id), useUpdateBudget() — TanStack Query + useMutation
- [ ] T024 [P] [US3] 예산 게이지 바 — `apps/web/src/components/budget/budget-gauge.tsx`: 사용률(%) 시각적 표시 (0-100%, 색상 변화: green→yellow→red)
- [ ] T025 [P] [US3] 예산 편집 모달 — `apps/web/src/components/budget/budget-edit-modal.tsx`: shadcn/ui Dialog — 토큰 한도, 비용 한도, 임계치 입력 + 유효성 검증 (양수, 범위)
- [ ] T026 [US3] Budget 페이지 — `apps/web/src/app/dashboard/budget/page.tsx`: Org 예산 현황 카드 + Team 리스트 (각 팀 게이지) + 편집 모달. viewer는 편집 숨김

---

## Phase 6: US4 — 사용자 및 API Key 관리 (P2)

**Goal**: 사용자 CRUD + API Key 생성/폐기 UI
**Independent Test**: Users 페이지 → 역할 변경 → API Keys → 키 생성 → 키 폐기

- [ ] T027 [P] [US4] useUsers + useApiKeys 훅 — `apps/web/src/hooks/use-users.ts`, `apps/web/src/hooks/use-api-keys.ts`: 목록 조회, 생성, 수정, 삭제
- [ ] T028 [P] [US4] DataTable 컴포넌트 — `apps/web/src/components/data-table/data-table.tsx`: shadcn/ui Table + 페이지네이션 + 검색 + 정렬. 재사용 가능
- [ ] T029 [US4] Users 페이지 — `apps/web/src/app/dashboard/users/page.tsx`: 사용자 테이블 (이름, 이메일, 역할, 팀, 마지막 활동) + Invite User 다이얼로그 + 역할 변경 드롭다운. member/viewer에게 메뉴 숨김
- [ ] T030 [US4] API Keys 페이지 — `apps/web/src/app/dashboard/api-keys/page.tsx`: API Key 테이블 (이름, prefix, 생성일, 마지막 사용, 상태) + Create Key 다이얼로그 (전체 키 1회 표시 + 경고) + Revoke 확인 다이얼로그

---

## Phase 7: US5 — SSE 실시간 모니터링 (P2)

**Goal**: SSE 실시간 요청 피드 + 연결 상태 인디케이터
**Independent Test**: Realtime 페이지 → SSE 연결 → LLM 요청 → 실시간 업데이트 → 재연결

- [ ] T031 [US5] SSE 백엔드 모듈 — `apps/api/src/events/events.module.ts`, `events.controller.ts`, `events.service.ts`: NestJS @Sse() 엔드포인트 + orgId별 연결 관리 + 30s heartbeat + JWT 인증
- [ ] T032 [US5] 이벤트 발행 통합 — `apps/api/src/events/events.gateway.ts`: RequestLogger (F005) 완료 후 이벤트 발행. BullMQ 또는 직접 EventEmitter 패턴
- [ ] T033 [P] [US5] SSE 클라이언트 — `apps/web/src/lib/sse-client.ts`: EventSource wrapper + 지수 백오프 재연결 (1s→2s→4s→8s→max 30s + jitter) + 연결 상태 관리
- [ ] T034 [P] [US5] useSSE 훅 — `apps/web/src/hooks/use-sse.ts`: SSE 이벤트 구독 + queryClient.invalidateQueries() 연동 + 연결 상태 expose
- [ ] T035 [US5] Realtime 페이지 — `apps/web/src/app/dashboard/realtime/page.tsx`: 연결 상태 인디케이터 (초록/빨강) + 실시간 요청 카운터 + Activity feed (모델, 토큰, 비용, 상태) + 탭 비활성 시 재연결

---

## Phase 8: US6 — 요청 로그 조회 (P2)

**Goal**: 로그 검색/필터/페이지네이션 + 상세 조회
**Independent Test**: Logs 페이지 → 필터 적용 → 페이지네이션 → 상세 모달

- [ ] T036 [P] [US6] useLogs 훅 — `apps/web/src/hooks/use-logs.ts`: useLogs(filters, page), useLogDetail(id) — TanStack Query + 필터 파라미터 관리
- [ ] T037 [US6] Logs 페이지 — `apps/web/src/app/dashboard/logs/page.tsx`: DataTable (시간, 모델, 사용자, 토큰, 비용, 상태, 레이턴시) + 필터 바 (model, status, 기간) + 페이지네이션 + 행 클릭 → 상세 모달 (마스킹된 입출력, Langfuse 링크)

---

## Phase 9: Polish & Cross-cutting

- [ ] T038 반응형 레이아웃 — 사이드바 + 테이블 + 차트 컴포넌트에 Tailwind 반응형 클래스 적용. 1024px+(desktop), 768px+(tablet) 브레이크포인트
- [ ] T039 데모 스크립트 — `demos/F007-admin-dashboard.sh`: API 서버 + Web 서버 시작 → 데모 데이터 시딩 → 브라우저 URL 안내 → Ctrl+C로 종료. `--ci` 모드: 헬스 체크 후 종료
- [ ] T040 [P] 컴포넌트 단위 테스트 — `apps/web/src/components/` 하위: budget-gauge, budget-edit-modal, data-table, usage-line-chart, cost-line-chart, model-bar-chart, team-bar-chart, loading-skeleton, error-state, empty-state, sidebar, header Jest 테스트
- [ ] T041 [P] 훅 단위 테스트 — `apps/web/src/hooks/` 하위: use-auth (login/logout/role check), use-budgets (CRUD), use-usage (period change), use-users, use-api-keys, use-logs (filter/pagination), use-sse (connect/disconnect/reconnect) Jest 테스트
- [ ] T042 [P] API 클라이언트 테스트 — `apps/web/src/lib/api-client.ts`: JWT interceptor, 401 자동 refresh, refresh queue race condition 방지, refresh 실패 시 리다이렉트
- [ ] T043 SSE 클라이언트 테스트 — `apps/web/src/lib/sse-client.ts`: 연결/해제, 지수 백오프 재연결 타이밍, heartbeat 처리, 이벤트 파싱
- [ ] T044 E2E 테스트 — Playwright: 로그인 → 대시보드 진입 → 사용량 차트 렌더링 → 예산 편집 → API Key 생성/폐기 → 로그 필터링 시나리오
- [ ] T045 [US3] Team 생성 UI — `apps/web/src/app/dashboard/budget/page.tsx`: Budget 페이지에 "Create Team" 버튼 + 모달 (팀 이름 입력 → POST /teams 호출 → 팀 목록 갱신)
- [ ] T046 [US3] Team Budget Edit 연결
- [ ] T047 [US4] 사용자 Team 배정 UI — `apps/web/src/app/dashboard/users/page.tsx`: Users 테이블에 Team 컬럼 추가 (드롭다운으로 Team 선택 → PATCH /users/:id { teamId } 호출 → 테이블 갱신)
- [ ] T048 [US4] PATCH /users/:id API — `apps/api/src/auth/organization.controller.ts`: F003 미구현 보조. JwtAuthGuard + Admin 체크 + { role?, teamId? } 업데이트 + 테넌트 격리 — `apps/web/src/app/dashboard/budget/page.tsx`: TeamBudgetRow의 Edit 버튼에 onClick → BudgetEditModal 열기 → PUT /budgets/team/:teamId 호출 → 게이지 업데이트

---

## Summary

| Phase | Tasks | Parallel | User Story |
|-------|-------|----------|------------|
| 1. Setup | T001-T004 | — | — |
| 2. Foundation | T005-T012 | T005-T009 | — |
| 3. US1 Login+Main | T013-T016 | — | P1 |
| 4. US2 Usage | T017-T022 | T017-T021 | P1 |
| 5. US3 Budget | T023-T026 | T023-T025 | P1 |
| 6. US4 Users/Keys | T027-T030 | T027-T028 | P2 |
| 7. US5 SSE Realtime | T031-T035 | T033-T034 | P2 |
| 8. US6 Logs | T036-T037 | T036 | P2 |
| 9. Polish | T038-T044 | T040-T042 | — |

**Total**: 46 tasks, 21 parallelizable
**MVP Scope**: Phase 1-4 (T001-T022, 22 tasks)
