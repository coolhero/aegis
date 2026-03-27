# Implementation Plan: F012 — Developer Playground

**Branch**: `012-developer-playground` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)

## Summary

개발자 Playground UI를 Next.js + shadcn/ui로 구현한다. F007 대시보드 레이아웃을 공유하며 `/playground` 경로에 모델 테스트, 비용 추정, 프롬프트 에디터, 히스토리, 모델 비교, API 탐색기 기능을 제공한다. 프론트엔드 전용 Feature (신규 백엔드 엔티티 없음).

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14, React 18, shadcn/ui, Tailwind CSS, gpt-tokenizer (토큰 카운팅)
**Storage**: 없음 (세션 내 React state만 사용)
**Testing**: Jest + React Testing Library (기존 F007 테스트 패턴)
**Project Type**: Frontend pages (`apps/web/src/app/playground/`)
**Constraints**: F007 대시보드 레이아웃 재사용. SSE 스트리밍은 기존 F007 SSE 클라이언트 패턴 활용.

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| Tenant Data Isolation | ✅ JWT 인증으로 자동 테넌트 격리 (API 호출 시 JWT → TenantContext) |
| Start Simple (YAGNI) | ✅ API 탐색기는 정적 목록. 동적 OpenAPI 생성 제외 |
| Fail-Open | N/A (프론트엔드 전용 — 에러 시 에러 메시지 표시) |

## Project Structure

```text
apps/web/src/app/playground/
├── page.tsx                    # Playground 메인 페이지
├── layout.tsx                  # Playground 레이아웃 (대시보드 레이아웃 재사용)
└── api-explorer/
    └── page.tsx                # API 탐색기 서브 페이지

apps/web/src/components/playground/
├── chat-panel.tsx              # 프롬프트 입력 + 스트리밍 응답 영역
├── model-selector.tsx          # 모델 드롭다운 + 파라미터 패널
├── cost-estimator.tsx          # 토큰 카운팅 + 비용 추정 표시
├── prompt-editor.tsx           # F010 템플릿 연동 프롬프트 에디터
├── history-panel.tsx           # 요청/응답 히스토리
├── compare-panel.tsx           # 모델 비교 side-by-side
└── api-explorer-panel.tsx      # API 탐색기 UI

apps/web/src/hooks/
├── use-playground.ts           # Playground 상태 관리 (히스토리, 파라미터)
├── use-streaming.ts            # SSE 스트리밍 연결 관리
├── use-token-counter.ts        # 토큰 카운팅 훅
└── use-models.ts               # 모델 목록 조회 훅

apps/web/src/lib/
├── token-counter.ts            # gpt-tokenizer 래퍼
└── api-catalog.ts              # API 탐색기 정적 엔드포인트 카탈로그
```

## Architecture

### Playground 상태 관리

```
usePlayground() — React Context
  ├── model: string (선택된 모델)
  ├── params: { temperature, max_tokens, top_p }
  ├── messages: Message[] (현재 대화)
  ├── history: HistoryEntry[] (세션 히스토리)
  ├── isStreaming: boolean
  └── compareModels: string[] (비교 모델 목록)
```

### SSE 스트리밍 플로우

```
ChatPanel.send()
  1. POST /v1/chat/completions (stream=true, via api-client.ts)
  2. EventSource.onmessage → 토큰 append to messages
  3. EventSource.onerror → 에러 표시
  4. Stop → AbortController.abort() + EventSource.close()
  5. 완료 → 히스토리 추가 + 실제 토큰/비용 표시
```

### 비용 추정 플로우

```
CostEstimator
  1. 입력 변경 → useTokenCounter(text) → inputTokens
  2. 모델 선택 → model.input_price_per_token, output_price_per_token
  3. 예상 비용 = inputTokens × inputPrice + maxTokens × outputPrice
  4. 응답 완료 후 → 실제 usage.prompt_tokens, usage.completion_tokens → 실제 비용
```

### F007 사이드바 연동

```
sidebar.tsx navItems에 추가:
  { href: '/playground', label: 'Playground', icon: '🧪', roles: ['admin', 'member'] }
```

### 모델 비교 플로우

```
ComparePanel
  1. 2~3개 모델 선택 → compareModels[]
  2. Compare 클릭 → Promise.all(models.map(fetch(stream=true)))
  3. 각 모델별 독립 EventSource → side-by-side 렌더링
  4. 완료 → 각 모델별 토큰/비용/응답시간 비교 표시
```

## RBAC 규칙

| Role | Playground | API Explorer |
|------|-----------|-------------|
| admin | ✅ | ✅ |
| member | ✅ | ✅ |
| viewer | ❌ (LLM 호출 불가) | ✅ (읽기만) |

## Complexity Tracking

해당 없음. Constitution 위반 없음.
