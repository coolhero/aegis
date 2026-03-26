# Research: F007 — Admin Dashboard

## 기술 스택 결정

### Next.js App Router
- **선택 근거**: Constitution에 명시된 프론트엔드 프레임워크. Server Components + Client Components 조합.
- **라우팅**: 파일 기반 라우팅 (`app/dashboard/usage/page.tsx` → `/dashboard/usage`)
- **미들웨어**: `middleware.ts`에서 JWT 검증 → 미인증 시 `/login` 리다이렉트

### shadcn/ui
- **선택 근거**: Tailwind CSS 기반, 커스터마이징 가능, 접근성(a11y) 기본 지원
- **주요 컴포넌트**: Card, Table, Dialog, Form, Input, Button, Select, Badge, Tabs, Skeleton
- **설치**: `npx shadcn-ui@latest init` → 개별 컴포넌트 추가

### TanStack Query v5
- **선택 근거**: 서버 상태 관리의 표준. 캐시, 리페치, optimistic update 자동 처리.
- **캐시 전략**: staleTime=30s, gcTime=5min, refetchInterval=60s (사용량 페이지)
- **Query Key 관리**: `queryKeys` 상수 객체로 일관된 키 관리

### Recharts 2.x
- **선택 근거**: React 생태계 표준 차트 라이브러리. SVG 기반, 반응형, shadcn/ui 호환.
- **차트 타입**: LineChart (트렌드), BarChart (비교), PieChart (비율)
- **대안 검토**: Chart.js (canvas 기반, React 통합이 Recharts보다 불편), Nivo (과도한 기능)

### SSE (EventSource)
- **선택 근거**: 서버→클라이언트 단방향 스트림에 최적. WebSocket보다 단순.
- **재연결**: 브라우저 기본 재연결 비활성화 → 커스텀 지수 백오프 (1s, 2s, 4s, 8s, max 30s, +jitter)
- **인증**: URL query parameter (`?token=<jwt>`) 또는 Last-Event-ID 헤더
- **NestJS 통합**: `@Sse()` 데코레이터 + `Observable<MessageEvent>` 반환

## JWT 토큰 관리

### Access Token 저장
- **httpOnly cookie 또는 메모리**: XSS 방지를 위해 localStorage 사용 안 함
- **MVP 접근**: 메모리(React Context) 저장 + 새로고침 시 refresh token으로 재발급
- **Axios interceptor**: 401 응답 시 자동 refresh → 원래 요청 재시도 (큐 방식)

### Refresh Token Rotation
- F003에서 이미 구현됨. 대시보드는 이를 소비만 함.
- 동시 요청 시 race condition 방지: refresh 중 다른 요청은 대기 → refresh 완료 후 일괄 재시도

## RBAC 구현 전략

### 클라이언트 측 역할 체크
- JWT에서 `role` claim 추출 → React Context에 저장
- `useAuth()` 훅에서 `hasRole('admin')`, `canEdit()` 등 유틸리티 제공
- 역할별 UI 가시성: `{isAdmin && <EditButton />}` 패턴
- **주의**: 클라이언트 측 체크는 UX 용도. 실제 권한은 백엔드 API에서 강제.

## SSE 백엔드 설계

### NestJS Events 모듈
- `EventsController`: `@Sse('stream')` 엔드포인트
- `EventsService`: orgId별 연결 관리 (Map 기반)
- `EventsGateway`: BullMQ 이벤트 구독 → 해당 org 연결에 이벤트 전달
- RequestLogger (F005)가 로그 저장 후 BullMQ에 `request.completed` 이벤트 발행 → EventsGateway가 수신
