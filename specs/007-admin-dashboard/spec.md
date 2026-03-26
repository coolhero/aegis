# Feature Specification: F007 — Admin Dashboard

**Feature Branch**: `007-admin-dashboard`
**Created**: 2026-03-26
**Status**: Draft
**Input**: Next.js + shadcn/ui 기반 관리 대시보드. 사용량/비용 차트, 팀 분석, 예산/사용자/API Key 관리, SSE 실시간 모니터링.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 대시보드 로그인 및 메인 화면 (Priority: P1)

조직 관리자(Org Admin)가 이메일/비밀번호로 대시보드에 로그인하면 JWT Access Token이 발급되고, 메인 대시보드 화면에 진입한다. 메인 화면에서는 조직의 총 사용량, 비용, 활성 사용자 수 등 핵심 지표를 한눈에 확인할 수 있다. 미인증 사용자는 로그인 페이지로 리다이렉트된다.

**Why this priority**: 대시보드 진입점. 인증 없이는 어떤 관리 기능도 사용 불가. 모든 후속 기능의 전제 조건.

**Independent Test**: 이메일/비밀번호로 로그인 → 대시보드 메인 화면 표시 → 핵심 지표 카드 렌더링 확인. 미인증 상태에서 `/dashboard` 접근 → 로그인 페이지 리다이렉트 확인.

**Acceptance Scenarios**:

1. **Given** 등록된 admin 사용자, **When** 로그인 폼에 올바른 이메일+비밀번호 입력 후 Submit, **Then** JWT 토큰 저장 + `/dashboard` 메인 화면으로 이동 + 조직 이름 표시.
2. **Given** 미인증 사용자, **When** `/dashboard` URL 직접 접근, **Then** `/login` 페이지로 리다이렉트.
3. **Given** 로그인된 사용자, **When** 메인 대시보드 화면 진입, **Then** 총 사용량(토큰), 총 비용($), 활성 사용자 수, 오늘의 요청 수 등 핵심 KPI 카드가 렌더링.
4. **Given** Access Token 만료, **When** 대시보드 API 호출 시 401 응답, **Then** Refresh Token으로 자동 갱신 시도 → 성공 시 원래 요청 재시도, 실패 시 로그인 페이지 리다이렉트.
5. **Given** viewer 역할 사용자, **When** 로그인 후 대시보드 진입, **Then** 읽기 전용 UI 표시 — 관리 버튼(수정, 삭제, 생성 등) 비활성화 또는 숨김.

---

### User Story 2 — 사용량 및 비용 대시보드 (Priority: P1)

조직 관리자가 기간별(일/주/월), 모델별, 팀별 LLM 사용량과 비용을 차트로 시각화하여 확인한다. 차트는 line chart(트렌드), bar chart(비교)로 표시되며, 기간 선택기(date picker)로 조회 범위를 조정할 수 있다.

**Why this priority**: 대시보드의 핵심 가치. 사용 현황 파악 없이는 예산/운영 의사결정 불가.

**Independent Test**: 로그인 → 사용량/비용 대시보드 탭 진입 → 기간 선택 → 차트 렌더링 확인 → 팀별/모델별 breakdown 확인.

**Acceptance Scenarios**:

1. **Given** 로그인된 admin, **When** Usage 페이지 진입, **Then** 기본 기간(최근 7일) 기준 일별 사용량 line chart + 비용 line chart 렌더링.
2. **Given** Usage 페이지, **When** 기간을 "This Month"로 변경, **Then** 해당 월의 일별 데이터로 차트 업데이트.
3. **Given** Usage 페이지, **When** "Model Breakdown" 탭 선택, **Then** 모델별 토큰 사용량 bar chart 렌더링 + 각 모델의 비율(%) 표시.
4. **Given** Usage 페이지, **When** "Team Breakdown" 탭 선택, **Then** 팀별 비용 비교 bar chart 렌더링 + 각 팀의 비용 순위 표시.
5. **Given** 데이터가 없는 새 조직, **When** Usage 페이지 진입, **Then** Empty state 화면 표시 — "아직 사용 데이터가 없습니다. API를 통해 LLM 요청을 보내면 여기에 표시됩니다."
6. **Given** API 오류 발생, **When** 사용량 데이터 fetch 실패, **Then** 에러 상태 UI 표시 + 재시도 버튼.

---

### User Story 3 — 예산 관리 UI (Priority: P1)

조직 관리자가 대시보드에서 Org/Team/User 계층의 예산을 설정하고, 현재 사용률을 확인하며, 알림 임계치를 조정한다. 예산 게이지(진행 바)가 현재 사용률을 시각적으로 표시한다.

**Why this priority**: 예산 통제는 엔터프라이즈 AI 거버넌스의 핵심. 코어 비즈니스 가치.

**Independent Test**: 로그인 → 예산 관리 페이지 → Org 예산 설정 → Team 예산 배분 → 사용률 게이지 확인.

**Acceptance Scenarios**:

1. **Given** admin 사용자, **When** Budget 페이지 진입, **Then** Org 레벨 예산 현황 표시 — 총 예산, 사용량, 잔여, 사용률(%) 게이지 바.
2. **Given** Budget 페이지, **When** Org 예산 편집 버튼 클릭 → 토큰 한도 2,000,000 / 비용 한도 $200 입력 → 저장, **Then** `PUT /budgets/org/:orgId` 호출 → 성공 → 게이지 업데이트.
3. **Given** Budget 페이지, **When** Team 탭 선택, **Then** 팀 목록 + 각 팀의 예산/사용률 표시 → 팀 클릭 → Team 예산 편집 모달.
4. **Given** Budget 페이지, **When** 알림 임계치를 80%, 90%, 100%로 설정 → 저장, **Then** 임계치 설정 반영.
5. **Given** viewer 사용자, **When** Budget 페이지 진입, **Then** 예산 현황 조회 가능 but 편집/저장 버튼 숨김.
6. **Given** 예산 설정 시 토큰 한도 0 또는 음수 입력, **When** 저장 시도, **Then** 클라이언트 측 유효성 검증 에러 표시.

---

### User Story 4 — 사용자 및 API Key 관리 (Priority: P2)

조직 관리자가 사용자를 초대/역할 변경/비활성화하고, API Key를 생성/폐기한다. 사용자 목록과 API Key 목록이 테이블 형태로 표시되며, 검색/필터링이 가능하다.

**Why this priority**: 조직 운영에 필수이나, 사용량/예산 대시보드 이후 순위. CRUD 관리 기능.

**Independent Test**: 로그인 → Users 페이지 → 사용자 목록 확인 → 역할 변경 → API Keys 페이지 → 새 키 생성 → 키 폐기.

**Acceptance Scenarios**:

1. **Given** admin 사용자, **When** Users 페이지 진입, **Then** 조직 내 사용자 테이블 표시 — 이름, 이메일, 역할, 팀, 마지막 활동, 상태 컬럼.
2. **Given** Users 테이블, **When** 특정 사용자의 역할을 member → viewer로 변경, **Then** `PUT /users/:id` 호출 → 성공 → 테이블 업데이트.
3. **Given** admin, **When** "Invite User" 버튼 → 이메일+역할 입력 → 초대, **Then** 사용자 생성 API 호출 → 테이블에 새 사용자 추가.
4. **Given** admin, **When** API Keys 페이지 진입, **Then** API Key 목록 표시 — 이름, prefix(마지막 4자리), 생성일, 마지막 사용일, 상태.
5. **Given** API Keys 페이지, **When** "Create API Key" 버튼 → 이름+스코프 입력 → 생성, **Then** 새 API Key 전문(full key) 1회 표시 → "이 키는 다시 볼 수 없습니다" 경고.
6. **Given** API Keys 페이지, **When** 특정 키의 Revoke 버튼 → 확인 다이얼로그 → 확인, **Then** `DELETE /api-keys/:id` → 키 상태 revoked → 테이블 업데이트.
7. **Given** member 사용자, **When** Users 페이지 접근 시도, **Then** 403 또는 사이드바에서 메뉴 숨김.

---

### User Story 5 — SSE 실시간 모니터링 (Priority: P2)

조직 관리자가 대시보드에서 실시간 LLM 요청 현황을 모니터링한다. SSE(Server-Sent Events) 연결을 통해 새 요청이 발생할 때마다 실시간으로 차트와 활동 피드가 업데이트된다.

**Why this priority**: 실시간 모니터링은 운영 가시성을 높이지만, 핵심 CRUD 기능 이후 구현.

**Independent Test**: 로그인 → 실시간 모니터링 탭 → SSE 연결 확인 → 다른 터미널에서 LLM 요청 전송 → 실시간 업데이트 확인.

**Acceptance Scenarios**:

1. **Given** 로그인된 admin, **When** 실시간 모니터링 페이지 진입, **Then** SSE 연결 수립 + 연결 상태 인디케이터(초록 점) 표시.
2. **Given** SSE 연결 수립, **When** 새 LLM 요청 처리 완료, **Then** 실시간 요청 수 카운터 증가 + 활동 피드에 최신 요청 추가(모델, 토큰, 비용, 상태).
3. **Given** SSE 연결 중, **When** 네트워크 일시 끊김, **Then** 연결 상태 인디케이터 빨간색 + 지수 백오프로 자동 재연결 시도 + 재연결 성공 시 초록 상태 복귀.
4. **Given** SSE 연결 수립, **When** 30초간 이벤트 없음, **Then** keep-alive heartbeat 수신 (연결 유지 확인).
5. **Given** 브라우저 탭 비활성 상태, **When** 탭 다시 활성화, **Then** SSE 재연결 + 누락 이벤트 표시 또는 최신 상태 갱신.

---

### User Story 6 — 요청 로그 조회 (Priority: P2)

조직 관리자가 대시보드에서 LLM 요청 로그를 검색하고 상세 내용을 확인한다. 모델, 사용자, 상태, 기간별 필터링이 가능하며, 페이지네이션으로 대량 로그를 효율적으로 탐색한다.

**Why this priority**: 운영 진단과 사용 패턴 파악에 필요. 분석 대시보드의 상세 드릴다운.

**Independent Test**: 로그인 → Logs 페이지 → 로그 목록 확인 → 필터 적용 → 상세 조회.

**Acceptance Scenarios**:

1. **Given** admin 사용자, **When** Logs 페이지 진입, **Then** 최신순 요청 로그 테이블 표시 — 시간, 모델, 사용자, 토큰(in/out), 비용, 상태, 레이턴시.
2. **Given** Logs 테이블, **When** model=gpt-4o + status=success + 기간 2026-03-01~03-31 필터 적용, **Then** 필터링된 결과만 표시.
3. **Given** Logs 테이블, **When** 특정 로그 행 클릭, **Then** 상세 모달 표시 — 마스킹된 입력/출력, 토큰 상세, Langfuse trace 링크.
4. **Given** 로그가 1000건 이상, **When** 페이지네이션 네비게이션, **Then** 20건씩 페이지 이동 + 전체 페이지 수 표시.

---

### Edge Cases

- 동시에 여러 탭에서 대시보드 열림 → 각 탭에서 독립적으로 SSE 연결 관리
- Access Token 만료 동안 여러 API 호출 진행 중 → 첫 401 응답에서만 refresh, 나머지는 대기 후 재시도 (토큰 갱신 경합 방지)
- 네트워크 완전 오프라인 → 오프라인 배너 표시 + 모든 mutate 비활성화
- 매우 큰 조직 (사용자 500+, 팀 50+) → 페이지네이션 + 검색으로 대응
- 예산 0원/0토큰 설정 → "예산 비활성화" 의미로 해석, 확인 다이얼로그 표시

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 JWT 인증 기반으로 대시보드 접근을 제어해야 한다. `POST /auth/login`으로 로그인, Access Token으로 API 호출, Refresh Token으로 자동 갱신.
- **FR-002**: 시스템은 RBAC 역할(admin, member, viewer)에 따라 UI 요소의 가시성과 상호작용을 제어해야 한다. admin=전체, member=조회+LLM, viewer=조회만.
- **FR-003**: 시스템은 기간별(일/주/월), 모델별, 팀별 사용량(토큰)과 비용($)을 차트로 시각화해야 한다.
- **FR-004**: 시스템은 팀별 비용 비교 차트와 사용 트렌드를 표시해야 한다.
- **FR-005**: 시스템은 Org/Team/User 계층의 예산을 조회/설정/수정하는 UI를 제공해야 한다. 토큰 한도, 비용 한도, 알림 임계치 설정 포함.
- **FR-006**: 시스템은 사용자 목록 조회, 초대(생성), 역할 변경, 비활성화 기능을 제공해야 한다.
- **FR-007**: 시스템은 API Key 생성, 목록 조회, 폐기 기능을 제공해야 한다. 생성 시 전체 키 1회 표시.
- **FR-008**: 시스템은 SSE(Server-Sent Events)를 통해 실시간 LLM 요청 현황을 모니터링하는 UI를 제공해야 한다.
- **FR-009**: 시스템은 SSE 연결 끊김 시 지수 백오프 전략으로 자동 재연결해야 한다.
- **FR-010**: 시스템은 LLM 요청 로그를 검색/필터링/페이지네이션하여 조회하는 UI를 제공해야 한다.
- **FR-011**: 시스템은 데이터 로딩 중(스켈레톤), 에러(재시도 옵션), 빈 상태(안내 메시지) UI를 표시해야 한다.
- **FR-012**: 시스템은 데스크톱(1024px+)과 태블릿(768px+) 해상도에 반응형으로 대응해야 한다.
- **FR-013**: 시스템은 사이드바 네비게이션으로 Dashboard, Usage, Budget, Users, API Keys, Logs, Realtime 페이지 간 이동을 제공해야 한다.
- **FR-014**: 시스템은 SSE 백엔드 엔드포인트(`GET /events/stream`)를 제공하여 테넌트 격리된 실시간 이벤트를 스트리밍해야 한다.
- **FR-015**: 시스템은 Team 생성/조회 기능을 Budget 페이지에서 제공해야 한다. 조직 관리자가 새 Team을 생성하고, 각 Team에 예산을 설정할 수 있어야 한다.
- **FR-016**: 시스템은 Team 레벨의 예산을 편집하는 UI를 제공해야 한다. Team Budget 편집 시 동일한 Budget Edit 모달을 재사용한다.
- **FR-017**: 시스템은 사용자를 Team에 배정/변경하는 UI를 제공해야 한다. Users 페이지에서 사용자의 Team을 변경할 수 있어야 한다.
- **FR-018**: 시스템은 `PATCH /users/:id` API를 제공하여 사용자의 역할(role)과 팀(teamId)을 수정할 수 있어야 한다. 이 API는 F003 범위이지만 F003이 미구현하여 F007에서 보조 구현한다. Admin 권한 필요.

### Key Entities

- **Dashboard View** (프론트엔드 전용): 로그인 세션, 현재 선택 기간, 필터 상태, SSE 연결 상태
- 기존 엔티티 참조: Organization, Team, User, ApiKey (F003), Budget, BudgetPeriod, UsageRecord (F004), RequestLog (F005)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 미인증 사용자가 `/dashboard` 접근 시 `/login`으로 리다이렉트되고, 올바른 자격증명으로 로그인 시 대시보드 메인 화면이 2초 이내 표시된다.
- **SC-002**: admin 역할은 예산 설정, 사용자 관리, API Key 관리 모든 기능 접근 가능하고, viewer 역할은 모든 페이지를 조회만 가능하며 편집/생성/삭제 UI가 숨겨지거나 비활성화된다.
- **SC-003**: 사용량/비용 차트가 일/주/월 기간별로 정확히 렌더링되며, 기간 변경 시 1초 이내 차트가 업데이트된다.
- **SC-004**: 팀별 비용 비교 bar chart가 모든 팀을 포함하여 렌더링되고, 비용 순위가 정확하다.
- **SC-005**: Org 예산 설정 UI에서 토큰 한도와 비용 한도를 입력 → 저장 시 `PUT /budgets/org/:orgId` 호출 성공 → 게이지 바 업데이트.
- **SC-006**: API Key 생성 시 전체 키가 1회 표시되고, 폐기(Revoke) 시 확인 다이얼로그 후 키 상태가 revoked로 변경.
- **SC-007**: SSE 연결이 수립되면 실시간 이벤트(새 요청)가 1초 이내 UI에 반영되고, 연결 끊김 시 지수 백오프로 3회 이내 자동 재연결.
- **SC-008**: 대시보드가 1024px(데스크톱)과 768px(태블릿) 뷰포트에서 레이아웃이 깨지지 않고 정상 렌더링.
- **SC-009**: 데이터 로딩 시 스켈레톤 UI 표시, API 에러 시 에러 메시지 + 재시도 버튼, 데이터 없을 시 안내 메시지 표시.
- **SC-010**: 사용자 역할 변경 UI에서 member→viewer 변경 → 저장 시 성공, 변경된 역할이 테이블에 즉시 반영.
- **SC-011**: 요청 로그 테이블에서 모델/상태/기간 필터 적용 시 정확한 결과만 표시, 로그 상세 클릭 시 마스킹된 입출력과 Langfuse trace 링크 표시.
- **SC-012**: Access Token 만료 시 Refresh Token으로 자동 갱신되며, 갱신 실패 시 로그인 페이지로 리다이렉트.
- **SC-013**: Budget 페이지에서 "Create Team" 버튼 → 팀 이름 입력 → 생성 시 `POST /teams` 호출 성공 → 팀 목록에 새 팀 추가.
- **SC-014**: Team Budget의 Edit 버튼 → Budget Edit 모달 표시 → 토큰/비용 한도 수정 → 저장 시 `PUT /budgets/team/:teamId` 호출 성공 → 게이지 업데이트.
- **SC-015**: Users 테이블에서 사용자의 Team 컬럼을 드롭다운으로 변경 → `PATCH /users/:id` 호출 성공 → 테이블에 변경된 Team 즉시 반영.
- **SC-016**: `PATCH /users/:id` API가 Admin 인증 하에 role과 teamId를 수정하고 200 응답을 반환한다. 비-Admin 호출 시 403.

## Assumptions

- Next.js App Router + shadcn/ui + TanStack Query 기술 스택을 사용한다 (constitution에 명시).
- 차트 라이브러리는 Recharts를 사용한다 (React 생태계 표준, shadcn/ui 호환).
- F003 Auth API (`/auth/login`, `/auth/refresh`)가 구현 완료 상태이다.
- F004 Budget API (`/budgets`, `/usage`)가 구현 완료 상태이다.
- F005 Logging API (`/logs`, `/analytics`)가 구현 완료 상태이다.
- SSE 백엔드 엔드포인트(`GET /events/stream`)는 F007 구현 시 NestJS 백엔드에 새로 추가한다.
- 모바일(768px 미만) 지원은 이 Feature 범위 밖이다.
- 국제화(i18n)는 이 Feature 범위 밖이다. UI 언어는 영어 기본.
- TanStack Query의 staleTime=30초, refetchInterval=60초를 기본 캐시 전략으로 사용한다.
