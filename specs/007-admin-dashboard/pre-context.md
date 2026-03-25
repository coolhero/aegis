# Pre-Context: F007 — Admin Dashboard

## Feature Summary
Next.js + shadcn/ui + TanStack Query 기반 관리 대시보드. 사용량/비용 대시보드, 팀 분석, 예산 관리 UI, 사용자/API Key 관리, SSE 실시간 차트를 제공한다.

## User & Purpose
- **Actor(s)**: 조직 관리자(Org Admin), 팀 리더, 플랫폼 운영자
- **Problem**: CLI나 API만으로는 조직의 LLM 사용 현황 파악, 예산 관리, 사용자 관리가 비효율적
- **Key Scenarios**: 일/주/월별 사용량 대시보드 확인, 팀별 비용 비교 차트, 예산 임계치 설정, API Key 생성/폐기, 실시간 사용량 모니터링

## Capabilities
- 사용량/비용 대시보드 (기간별, 모델별, 팀별 breakdown)
- 팀 분석 (팀간 비용 비교, 트렌드)
- 예산 관리 UI (계층별 예산 설정, 임계치 조정)
- 사용자 관리 (초대, 역할 변경, 비활성화)
- API Key 관리 (생성, 폐기, 권한 범위 설정)
- SSE 기반 실시간 사용량 차트
- 반응형 레이아웃 (데스크톱 + 태블릿)

## Data Ownership
- **Owns**: 없음 (프론트엔드 전용 — 모든 데이터는 백엔드 API 소비)
- **References**: Organization, Team, User, ApiKey (F003), Budget, UsageRecord (F004), RequestLog (F005)

## Interfaces
- **Provides**: 웹 대시보드 UI (`/dashboard/*` 라우트)
- **Consumes**: F001 HealthCheck API, F003 Auth/User/Team/Org API, F004 Budget/Usage API, F005 Logs/Analytics API

## Dependencies
- F001 Foundation Setup (API 기반)
- F003 Auth & Multi-tenancy (로그인, 사용자 관리 API)
- F004 Token Budget Management (예산 관리 API)
- F005 Request Logging & Tracing (로그/분석 API)

## Domain-Specific Notes
- **ai-gateway Archetype**: 대시보드는 게이트웨이 관리자/거버넌스 레이어의 UI 표현
- SSE 실시간 차트는 F002의 스트리밍 아키텍처와 일관된 이벤트 소싱 패턴 사용
- 대시보드 자체는 LLM 호출을 하지 않으므로 가드레일/예산 체크 불필요

## For /speckit.specify
- SC 필수: JWT 인증 기반 대시보드 접근, 역할별 UI 요소 가시성 (admin은 전체, viewer는 읽기만)
- SC 필수: SSE 연결 관리 (연결 끊김 시 재연결, 백오프 전략)
- SC 필수: 대시보드 데이터 로딩 상태 (loading, error, empty state)
- 차트 라이브러리 선정: Recharts 또는 Chart.js
- TanStack Query 캐시 전략 (staleTime, refetchInterval)
- 접근성(a11y) 기본 준수 (키보드 네비게이션, 스크린리더)
