# Tasks: F012 — Developer Playground

**Input**: Design documents from `/specs/012-developer-playground/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/playground-api.md

## Phase 1: Setup (라우트 + 레이아웃)

- [ ] **T001** [US1] Playground 라우트 + 사이드바 연동
  - `apps/web/src/app/playground/page.tsx` — Playground 메인 페이지 (빈 레이아웃)
  - `apps/web/src/app/playground/layout.tsx` — 대시보드 레이아웃 재사용 (F007 layout import)
  - F007 `sidebar.tsx` navItems에 Playground 메뉴 추가
  - **Micro-Verify**: `/playground` 접근 → 사이드바에 Playground 메뉴 표시 + 페이지 렌더링

## Phase 2: 모델 선택 + 파라미터 (P1)

- [ ] **T002** [US1] 모델 선택 + 파라미터 패널 + Playground 상태 관리
  - `apps/web/src/hooks/use-models.ts` — 모델 목록 조회 (정적 목록 + F002 Model 데이터)
  - `apps/web/src/hooks/use-playground.ts` — Playground 상태 Context (model, params, messages, history)
  - `apps/web/src/components/playground/model-selector.tsx` — 모델 드롭다운 + temperature/max_tokens/top_p 슬라이더
  - **Micro-Verify**: 페이지에 모델 드롭다운 + 파라미터 슬라이더 렌더링

## Phase 3: 스트리밍 채팅 (P1)

- [ ] **T003** [US1] SSE 스트리밍 채팅 UI
  - `apps/web/src/hooks/use-streaming.ts` — SSE EventSource 연결 관리 (send, stop, abort)
  - `apps/web/src/components/playground/chat-panel.tsx` — 프롬프트 입력 + 스트리밍 응답 영역 + Stop 버튼 + 에러 표시
  - page.tsx 통합: ModelSelector + ChatPanel 조합
  - **Micro-Verify**: 프롬프트 입력 → Send → 스트리밍 응답 렌더링 (또는 mock 데이터로 UI 확인)

## Phase 4: 비용 추정 (P1)

- [ ] **T004** [US2] 토큰 카운팅 + 비용 추정
  - `apps/web/src/lib/token-counter.ts` — gpt-tokenizer 래퍼 (encode → length)
  - `apps/web/src/hooks/use-token-counter.ts` — 실시간 토큰 카운팅 훅 (debounced)
  - `apps/web/src/components/playground/cost-estimator.tsx` — 예상/실제 토큰 + 비용 표시 패널
  - `package.json`에 `gpt-tokenizer` 의존성 추가
  - **Micro-Verify**: 텍스트 입력 → 토큰 수 실시간 변경 확인

## Phase 5: 프롬프트 에디터 (P2)

- [ ] **T005** [US3] 프롬프트 에디터 (F010 연동)
  - `apps/web/src/components/playground/prompt-editor.tsx` — 템플릿 선택 드롭다운 + 변수 폼 + 렌더링 프리뷰 + Send
  - F010 API 연동: GET /prompts → POST /prompts/:id/resolve
  - 프롬프트 에디터 탭을 page.tsx에 추가 (탭 UI: Chat / Prompt Editor)
  - **Micro-Verify**: 템플릿 목록 로드 (또는 mock) → 변수 폼 렌더링

## Phase 6: 히스토리 (P2)

- [ ] **T006** [US4] 요청/응답 히스토리 패널
  - `apps/web/src/components/playground/history-panel.tsx` — 히스토리 사이드 패널 (model, 프롬프트 첫 줄, 토큰, timestamp)
  - use-playground.ts에 히스토리 관리 로직 추가 (addToHistory, selectFromHistory)
  - 히스토리 항목 클릭 → 프롬프트/파라미터 자동 채움
  - **Micro-Verify**: 요청 후 히스토리 패널에 항목 표시 확인

## Phase 7: 모델 비교 (P3)

- [ ] **T007** [US5] 모델 비교 side-by-side
  - `apps/web/src/components/playground/compare-panel.tsx` — 2~3개 모델 선택 + side-by-side 스트리밍 + 비용/토큰 비교
  - Compare 탭을 page.tsx에 추가 (탭 UI: Chat / Prompt Editor / Compare)
  - 최대 3개 모델 제한 + 동시 SSE 연결
  - **Micro-Verify**: 2개 모델 선택 → Compare → side-by-side 패널 렌더링

## Phase 8: API 탐색기 (P3)

- [ ] **T008** [US6] API 탐색기
  - `apps/web/src/lib/api-catalog.ts` — AEGIS API 정적 엔드포인트 카탈로그 (F001~F011 API)
  - `apps/web/src/components/playground/api-explorer-panel.tsx` — 엔드포인트 목록 + 상세 + Try it
  - `apps/web/src/app/playground/api-explorer/page.tsx` — API 탐색기 서브 페이지
  - **Micro-Verify**: API 목록 렌더링 + 엔드포인트 선택 → 상세 표시

## Phase 9: 테스트 + Demo

- [ ] **T009** [ALL] 테스트 + 데모 스크립트
  - `apps/web/src/__tests__/components/playground/` — ChatPanel, ModelSelector, CostEstimator 단위 테스트
  - `demos/F012-developer-playground.sh` — 데모 스크립트 (기본 모드 + --ci 모드)
  - **Micro-Verify**: `npm test` 통과 + `npm run build` 성공

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 1 Setup | T001 | - |
| 2 Model+Params | T002 | T001 |
| 3 Streaming | T003 | T002 |
| 4 Cost Estimation | T004 | T002 |
| 5 Prompt Editor | T005 | T003 |
| 6 History | T006 | T003 |
| 7 Compare | T007 | T003 |
| 8 API Explorer | T008 | T001 |
| 9 Test+Demo | T009 | T001-T008 |

**병렬 가능**: T003 (Streaming) 이후 T005 (Prompt Editor), T006 (History), T007 (Compare)는 독립 개발 가능. T008 (API Explorer)은 T001 이후 독립 개발 가능.
**총 태스크**: 9개
