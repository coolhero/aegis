# Tasks: F010 — Prompt Management

**Input**: Design documents from `/specs/010-prompt-management/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/prompt-api.md

## Phase 1: Setup (Shared Infrastructure)

- [ ] **T001** [US1] NestJS PromptModule 생성 + 5개 TypeORM 엔티티 정의
  - `apps/api/src/prompt/prompt.module.ts`
  - `apps/api/src/prompt/prompt-template.entity.ts` (PromptTemplate)
  - `apps/api/src/prompt/prompt-version.entity.ts` (PromptVersion)
  - `apps/api/src/prompt/ab-test.entity.ts` (AbTest)
  - `apps/api/src/prompt/ab-test-variant.entity.ts` (AbTestVariant)
  - `apps/api/src/prompt/prompt-usage-stat.entity.ts` (PromptUsageStat)
  - AppModule에 PromptModule import
  - DB sync → 테이블 생성 확인
  - **Micro-Verify**: `npm run build` 성공 + 테이블 존재 확인

## Phase 2: User Story 1 — 프롬프트 CRUD + 버전 관리 (P1)

- [ ] **T002** [US1] PromptService + PromptVersionService + DTO 구현
  - `apps/api/src/prompt/prompt.service.ts` — CRUD (create, findAll, findOne, update, delete)
  - `apps/api/src/prompt/prompt-version.service.ts` — createVersion, findVersions, findVersion
  - `apps/api/src/prompt/dto/create-prompt.dto.ts`
  - `apps/api/src/prompt/dto/update-prompt.dto.ts`
  - 테넌트 격리: org_id 필터 적용
  - **Micro-Verify**: 단위 테스트 — create → findOne → update (새 버전 생성) → findVersions

- [ ] **T003** [US1] PromptController — CRUD + 버전 엔드포인트
  - `apps/api/src/prompt/prompt.controller.ts`
  - `POST /prompts`, `GET /prompts`, `GET /prompts/:id`, `PUT /prompts/:id`, `DELETE /prompts/:id`
  - `GET /prompts/:id/versions`
  - AuthGuard + TenantContext 적용
  - **Micro-Verify**: `curl POST /prompts → 201` + `curl GET /prompts → 200` + `curl GET /versions → 버전 목록`

- [ ] **T004** [US1] Publish + Rollback 구현
  - `apps/api/src/prompt/dto/publish-prompt.dto.ts`
  - `apps/api/src/prompt/dto/rollback-prompt.dto.ts`
  - `POST /prompts/:id/publish` — active_version 설정, status → published
  - `POST /prompts/:id/rollback` — target_version으로 active_version 변경 + 활성 A/B 테스트 자동 종료
  - **Micro-Verify**: `curl POST /publish → 200 + status=published` + `curl POST /rollback → 200 + active_version 변경`

## Phase 3: User Story 2 — 변수 치환 (P1)

- [ ] **T005** [P] [US2] VariableParserService 구현
  - `apps/api/src/prompt/variable-parser.service.ts`
  - `extract(content)` — `{{var}}`, `{{var|default}}` 패턴 파싱 → `[{ name, required, default_value }]`
  - `resolve(content, templateVars, providedValues)` — 변수 치환 + 누락 검증
  - **Micro-Verify**: 단위 테스트 — extract 정확성 + resolve 치환 + 누락 에러

- [ ] **T006** [US2] VariableParser를 PromptService에 통합
  - create/update 시 `extract()` 호출 → variables 필드 자동 설정
  - **Micro-Verify**: `curl POST /prompts (content에 {{var}})` → 응답의 variables 필드에 추출된 변수 목록

## Phase 4: User Story 3 — A/B 테스팅 (P2)

- [ ] **T007** [US3] AbTestService 구현
  - `apps/api/src/prompt/ab-test.service.ts`
  - `apps/api/src/prompt/dto/create-ab-test.dto.ts`
  - createAbTest — variants 등록 + weight 합계 100 검증 + published 확인
  - findActiveTest — template_id로 활성 테스트 조회
  - endAbTest — status → completed, ended_at 설정
  - getStats — variant별 call_count, total_tokens
  - **Micro-Verify**: 단위 테스트 — 생성 + weight 검증 + 조회 + 종료

- [ ] **T008** [US3] A/B 테스트 Controller 엔드포인트
  - `POST /prompts/:id/ab-test`
  - `GET /prompts/:id/ab-test/stats`
  - `DELETE /prompts/:id/ab-test`
  - **Micro-Verify**: `curl POST /ab-test → 201` + `curl GET /stats → 변형별 통계` + `curl DELETE → 종료`

## Phase 5: User Story 4 — 프롬프트 해결 (P2)

- [ ] **T009** [US4] PromptResolverService 구현
  - `apps/api/src/prompt/prompt-resolver.service.ts`
  - `apps/api/src/prompt/dto/resolve-prompt.dto.ts`
  - resolve(templateId, variables, tenantContext):
    1. template 조회 + published 검증
    2. A/B 활성 시 가중치 기반 변형 선택
    3. variableParser.resolve() 호출
    4. usageStat 업데이트
  - **Micro-Verify**: `curl POST /resolve → 200 + 치환된 텍스트`

- [ ] **T010** [US4] Resolve Controller 엔드포인트 + X-Prompt-Variant 헤더
  - `POST /prompts/:id/resolve`
  - A/B 활성 시 `X-Prompt-Variant` 헤더 추가
  - viewer 역할 resolve 허용
  - **Micro-Verify**: `curl POST /resolve (A/B 활성)` → 헤더 확인 + `viewer resolve → 200`

## Phase 6: User Story 5 — 사용 통계 (P3)

- [ ] **T011** [US5] PromptStatsService + 통계 엔드포인트
  - `apps/api/src/prompt/prompt-stats.service.ts`
  - recordUsage(templateId) — call_count++, last_used_at 업데이트
  - `GET /prompts/:id/stats`
  - `GET /prompts?sort=call_count` — 목록 정렬 옵션 추가
  - **Micro-Verify**: resolve 여러 번 호출 → `curl GET /stats → call_count 증가 확인`

## Phase 7: RBAC + Edge Cases + 테스트

- [ ] **T012** [US1-5] RBAC 검증 + Edge Case 처리
  - viewer: POST/PUT/DELETE /prompts → 403, resolve/stats → 200
  - content > 100,000자 → 413
  - draft/archived resolve → 400
  - A/B weight 합 ≠ 100 → 400
  - **Micro-Verify**: 각 edge case에 대한 curl 검증

## Phase 8: Demo Script

- [ ] **T013** [ALL] 데모 스크립트 작성
  - `demos/F010-prompt-management.sh`
  - 기본 모드: 서버 시작 → 시드 데이터 → "Try it" 안내 → 대기
  - `--ci` 모드: 프롬프트 생성 → 수정 → 배포 → 변수 치환 → A/B 테스트 → 통계 → 헬스체크 → 종료

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 1 Setup | T001 | - |
| 2 CRUD+Version | T002, T003, T004 | T001 |
| 3 Variable | T005 [P], T006 | T005→T006, T002 |
| 4 A/B Test | T007, T008 | T001, T003 |
| 5 Resolve | T009, T010 | T005, T007 |
| 6 Stats | T011 | T009 |
| 7 RBAC+Edge | T012 | T001-T011 |
| 8 Demo | T013 | T001-T012 |

**병렬 가능**: T005 (VariableParser)는 T002-T004와 독립적으로 개발 가능
**총 태스크**: 13개
