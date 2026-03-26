# Skill Feedback Log — AEGIS Case Study

> spec-kit-skills 설계 의도대로 진행되지 않는 문제 발생 시 원인 분석 기록

---

## P1: Pipeline 산출물 불완전 — spec-kit 템플릿 형식 미준수

**발견 시점**: 2026-03-25, F001 Foundation Setup pipeline 완료 후
**심각도**: HIGH
**영향 범위**: F001 (이미 구현), F002 (진행 중)

### 증상

F001 pipeline 실행 후 생성된 산출물이 spec-kit 템플릿(`/.specify/templates/`)에서 요구하는 구조를 따르지 않음:

| 파일 | 템플릿 요구 | 실제 상태 |
|------|------------|----------|
| `spec.md` | User Scenarios, Acceptance Scenarios (Given/When/Then), Edge Cases, Assumptions 섹션 필수 | FR/SC만 있고 User Scenarios/Acceptance Scenarios 없음 |
| `research.md` | plan Phase 0에서 생성 (기술 리서치, 대안 분석) | **파일 자체 없음** |
| `data-model.md` | plan Phase 1에서 생성 (엔티티 상세 스키마) | **파일 자체 없음** (plan.md에 인라인) |
| `quickstart.md` | plan Phase 1에서 생성 (빠른 시작 가이드) | **파일 자체 없음** |
| `contracts/` | plan Phase 1에서 생성 (API 계약 디렉토리) | **디렉토리 자체 없음** |
| `tasks.md` | User Story별 Phase 구조, [P] 병렬 표시, 체크박스 완료 표시 | 단순 체크리스트, 미체크 상태 |

### 원인 분석

1. **spec-kit 인라인 실행 시 템플릿 참조 미흡**: pipeline.md에서 "인라인 실행" 지시 → `.claude/commands/speckit.*.md`를 읽어서 실행해야 하는데, 실제로는 speckit 명령을 읽지 않고 직접 산출물을 작성함
2. **속도 우선 접근**: 사용자가 "다 해버려"라고 요청 → 속도를 위해 간소화된 산출물 생성
3. **verify 단계 완전 스킵**: verify Phase 1~4 (build check, SC verification, cross-Feature, demo) 미수행

### 영향

- **Case Study 품질 저하**: spec-kit-skills의 전체 워크플로우를 보여주려는 목적인데, 핵심 산출물이 누락되면 케이스 스터디 가치 감소
- **Cross-Feature 일관성**: data-model.md, contracts/ 없으면 후속 Feature의 Context Assembly에서 참조할 데이터 부재
- **Verify 미수행**: SC 검증 없이 "완료" 처리 → 실제 동작 보장 불가

### 해결 방안

1. F001의 누락 산출물 보충 생성 (research.md, data-model.md, quickstart.md, contracts/)
2. spec.md를 spec-kit 템플릿 형식으로 재작성 (User Scenarios 추가)
3. tasks.md 체크박스 완료 처리 + User Story 구조 적용
4. verify Phase 1~4 수행
5. F002부터는 speckit.*.md 명령 파일을 실제로 읽고 실행

---

## P2: verify 단계 완전 스킵

**발견 시점**: 2026-03-25, F001 완료 후 사용자 피드백
**심각도**: HIGH

### 증상
F001 pipeline에서 implement 후 바로 "완료" 처리. verify Phase 1~4 (Health check, SC verification, Cross-Feature, Demo) 미수행.

### 원인
pipeline.md의 verify 워크플로우를 읽지 않음. 사용자의 "다 해버려" 요청으로 속도 최적화 시 verify를 건너뜀.

### 해결 방안
- 모든 Feature에서 verify 단계 필수 수행
- 최소한 build + test + SC 매핑 확인

---

## P3: Feature 병렬 실행 — pipeline 순차 실행 규칙 위반

**발견 시점**: 2026-03-25, F003/F004/F005 병렬 agent 실행 직후 사용자 피드백
**심각도**: CRITICAL
**상태**: 발견 즉시 중단

### 증상

F003, F004, F005를 3개의 background agent로 동시에 구현 시도. pipeline.md의 핵심 규칙을 위반:

> **"CRITICAL: Each Feature must complete ALL steps (from its starting step through verify and merge) before moving to the next Feature."**

### 위반된 규칙 상세

1. **pipeline.md line 920**: Feature는 반드시 순차 실행. 현재 Feature의 verify+merge 완료 전 다음 Feature 시작 금지.
2. **Context Reset Protocol**: Feature 간 context reset 권장 (`/clear` 후 재개). 병렬 실행은 이 프로토콜 자체를 무시.
3. **Registry Freshness Pre-check**: 각 Feature 시작 시 선행 Feature의 registry 반영 여부 확인 필요. 병렬이면 선행 Feature가 아직 미완료 → registry 미반영 → stale data.
4. **Cross-Feature Context Assembly**: F004는 F003의 Organization/Team/User 엔티티를 참조. F003이 미완료 상태에서 F004가 동일 엔티티를 중복 생성할 위험.
5. **Entity/API Registry 충돌**: 3개 agent가 동시에 entity-registry.md, api-registry.md, app.module.ts를 수정하면 파일 충돌 발생.

### 원인 분석

1. **사용자의 "다 해버려 모두" 요청을 속도 최적화로 해석**: 빠르게 진행하려는 의도를 "규칙을 무시해도 된다"로 오해
2. **Agent tool의 병렬 실행 가능성에 대한 과신**: Agent tool이 병렬 실행을 지원하지만, spec-kit-skills의 pipeline은 병렬을 명시적으로 금지
3. **pipeline.md의 CRITICAL 규칙을 읽었음에도 적용하지 않음**: pipeline.md를 읽고 Feature 순차 실행 규칙을 확인했지만, 사용자 요청의 긴급성을 우선시
4. **Cross-Feature 의존성 무시**: F004 → F003 의존 (Org/Team/User 엔티티), F005 → F002+F003 의존. 의존 관계가 있는 Feature를 병렬로 실행하면 참조 엔티티 불일치 위험

### 잠재적 영향 (발생 전 중단됨)

| 위험 | 설명 |
|------|------|
| **파일 충돌** | 3개 agent가 동시에 app.module.ts, index.ts, package.json 수정 → 마지막 쓰기만 유효 |
| **엔티티 중복** | F004가 F003의 User 엔티티를 직접 재정의 → entity-registry와 불일치 |
| **테스트 오염** | 한 agent의 코드 변경이 다른 agent의 테스트에 영향 |
| **Registry 비일관** | 동시 수정으로 entity-registry, api-registry 데이터 손실 |

### 해결 방안

1. **병렬 agent 결과 폐기**: 3개 background agent의 결과를 사용하지 않음
2. **순차 실행 재개**: F003 → verify+commit → F004 → verify+commit → F005 순서대로
3. **Feature 간 context reset**: 가능하면 `/clear` 후 재개 (현재 세션에서는 주의하며 순차 진행)
4. **원칙 확립**: "사용자가 빠르게 해달라"는 요청이 있더라도 pipeline 순차 규칙은 위반 불가

### 교훈

> **속도와 정확성의 트레이드오프에서, spec-kit-skills의 pipeline 규칙은 정확성 쪽이다.**
> 사용자가 속도를 원하더라도, 규칙을 무시하면 결과물의 품질과 일관성이 보장되지 않는다.
> "다 해버려"는 "빠르게 하되 규칙은 지켜라"로 해석해야 한다.

---

## P4: Feature Branch 관리 누락 — pipeline pre-flight/merge 규칙 미준수

**발견 시점**: 2026-03-25, F003 pipeline analyze 단계에서 사용자 피드백
**심각도**: MEDIUM
**상태**: F003에서 부분 수정 (브랜치 생성은 했으나 speckit.specify 스크립트 미사용)

### 증상

1. **F001, F002**: feature branch 없이 `main`에 직접 커밋됨. pipeline의 `pre-flight → Create Feature branch` + `merge → Merge Feature branch to main` 규칙 완전 무시.
2. **F003**: `git checkout -b 003-auth-multi-tenancy`로 수동 브랜치 생성은 했으나, `speckit.specify`의 `create-new-feature.sh` 스크립트를 건너뜀.

### 위반된 규칙

1. **pipeline.md line 929**: `0. pre-flight → Ensure on main branch (clean state) → Create Feature branch {NNN}-{short-name}`
2. **pipeline.md line 937**: `7. merge → Merge Feature branch to main → Cleanup`
3. **speckit.specify.md Outline #2**: `Create the feature branch by running the script with --short-name`

### 원인 분석

1. **pre-flight 브랜치 생성과 speckit.specify 스크립트의 브랜치 생성이 중복**: pipeline.md는 pre-flight에서 브랜치를 만들라 하고, speckit.specify도 `create-new-feature.sh`로 브랜치를 만들라 함. 어느 것을 따라야 하는지 혼동.
2. **`smart-sdd add`에서 이미 spec 디렉토리 생성**: `add` 단계에서 `specs/003-auth-multi-tenancy/pre-context.md`가 이미 존재 → `create-new-feature.sh`가 중복 디렉토리를 만들 것으로 판단해 건너뜀.
3. **F001/F002에서 브랜치 관리 자체를 누락**: 이전 세션에서 pipeline pre-flight를 수행하지 않았고, 이 패턴이 관성으로 계속됨.

### 실제 영향

- **코드 안전성**: feature branch 없이 main에 직접 커밋하면 verify 실패 시 롤백이 어려움
- **merge 단계 무의미**: 브랜치가 없으니 merge 단계를 수행할 수 없음
- **Case Study 완성도**: branch-per-Feature 워크플로우가 spec-kit의 핵심 가치인데 이를 보여주지 못함

### 해결 방안

1. **F003**: 이미 `003-auth-multi-tenancy` 브랜치에서 작업 중 — implement 완료 후 main으로 merge
2. **F004 이후**: pipeline pre-flight에서 `create-new-feature.sh` 또는 `git checkout -b`로 반드시 feature branch 생성
3. **smart-sdd add와 speckit.specify의 중복 해소 필요**: add에서 이미 디렉토리가 존재할 때 `create-new-feature.sh`의 동작을 어떻게 처리할지 스킬 차원에서 명확화 필요

### 교훈

> **pipeline의 pre-flight 브랜치 관리는 선택이 아닌 필수이다.**
> `add`에서 디렉토리가 이미 존재하더라도 feature branch는 반드시 생성해야 한다.
> `speckit.specify`의 `create-new-feature.sh`와 pipeline pre-flight의 중복은 스킬 설계 이슈로, 어느 한쪽으로 통일이 필요하다.

---

## P5: verify 단계 런타임 검증 미수행 — SC 검증이 단위 테스트에 그침

**발견 시점**: 2026-03-26, F003 verify 단계에서 사용자 피드백
**심각도**: HIGH
**상태**: 발견 즉시 기록, F003에서 수정 진행

### 증상

F003 verify 단계에서 `npm run build` + `npm test` (단위 테스트)만 수행하고, 실제 서버를 기동하여 API 엔드포인트를 호출하는 런타임 SC 검증을 수행하지 않음. verify Phase 2(SC 검증)를 단위 테스트 통과 여부로 대체한 것.

구체적으로:
- `POST /auth/login` 실제 호출 → JWT 토큰 수신 확인 ❌
- 수신한 토큰으로 보호 API 접근 확인 ❌
- API Key로 `POST /v1/chat/completions` 인증 확인 ❌
- Cross-tenant 격리 런타임 확인 ❌
- RBAC (admin/member/viewer) 접근 차이 런타임 확인 ❌
- Demo script `--ci` 모드 실행 ❌

### 원인 분석

1. **verify의 범위를 축소 해석**: "build + test pass = 검증 완료"로 단순화. pipeline의 verify-phases.md에서 요구하는 Phase 2(SC별 런타임 검증)와 Phase 3(데모 검증)를 건너뜀.
2. **인프라 의존성 회피**: 런타임 검증은 PostgreSQL, Redis가 실행 중이어야 함. Docker Compose 기동 여부를 확인하지 않고 스킵.
3. **시간 절약 의도**: 단위 테스트가 통과하면 런타임도 동작할 것이라는 가정. 단위 테스트의 mock과 실제 DB 동작은 다를 수 있음.
4. **P2 (verify 완전 스킵)의 반복**: P2에서 "verify 필수 수행"을 교훈으로 기록했지만, 이번에는 verify를 수행하긴 했으나 피상적으로 수행.

### 실제 영향

- **SC-001~SC-010 중 어느 것도 실제 환경에서 검증되지 않음**: TypeORM 엔티티가 실제 PostgreSQL에서 테이블을 올바르게 생성하는지, bcrypt 해싱이 실제로 동작하는지, JWT 토큰이 실제로 검증되는지 확인 불가
- **SeedService의 onModuleInit이 정상 동작하는지 확인 불가**: 데모 데이터가 실제로 생성되는지 런타임에서만 확인 가능
- **데모 스크립트가 동작하는지 확인 불가**: 작성만 하고 실행하지 않음

### 해결 방안

1. **Docker Compose 기동 확인**: verify 시작 시 `docker compose ps`로 인프라 상태 확인
2. **실제 서버 기동**: `npm run start:dev` 또는 별도 테스트 서버 기동
3. **SC별 curl/HTTP 검증**: 각 SC에 대해 실제 API 호출 + 응답 코드/본문 확인
4. **Demo script --ci 실행**: 최소한 CI 모드로 데모 스크립트가 성공하는지 확인
5. **검증 실패 시 구현으로 돌아가기**: 런타임 검증 실패 항목 발견 시 implement로 되돌아가 수정

### 교훈

> **단위 테스트 통과 ≠ 런타임 검증 완료.**
> verify Phase 2는 실제 서버+DB 환경에서 SC를 검증하는 것이다.
> 인프라가 없으면 인프라를 기동하거나 사용자에게 기동을 요청해야 한다.
> "빌드+테스트 통과"만으로 verify를 통과시키면 P2와 동일한 실수를 반복하는 것이다.

---

## P6: verify 런타임 검증 불완전 — SC 일부만 런타임, 나머지는 단위테스트로 대체

**발견 시점**: 2026-03-26, F003 verify 런타임 검증 후 사용자 피드백
**심각도**: MEDIUM
**상태**: F003에서 발견

### 증상

10개 SC 중 SC-007(cross-tenant 격리)과 SC-009(model scope 제한)을 런타임으로 검증하지 않고 "단위테스트" 통과로 대체. 결과 보고 표에 "단위테스트"로 표기하긴 했지만, verify의 목적은 **모든 SC를 런타임에서 확인**하는 것.

### 미수행 항목 상세

1. **SC-007 (Cross-tenant 격리)**: 두 번째 Organization을 생성하여 Org A의 데이터가 Org B에서 접근 불가능한지 런타임에서 확인해야 함. 실제로는 단일 Org 환경에서만 테스트.
2. **SC-009 (Model scope 제한)**: scopes가 `["gpt-4o"]`인 API Key로 `claude-sonnet-4-20250514` 모델 요청 시 403 반환 확인해야 함. 모델이 등록되지 않아 테스트 불가능했지만, 이를 명시하지 않음.

### 추가 문제: implement에서 잡았어야 할 버그 3개가 verify에서 발견

| 버그 | 발견 시점 | 있어야 할 시점 |
|------|----------|--------------|
| Redis circular import | verify (서버 기동 시) | implement Phase 6 (integration) |
| TypeORM nullable type | verify (서버 기동 시) | implement Phase 1 (entities) |
| ioredis ESM/CJS import | verify (서버 기동 시) | implement Phase 6 (pre-existing F001 bug) |

이 3개 버그는 implement 단계에서 서버를 한 번이라도 기동해봤으면 즉시 발견됐을 것. implement에서 빌드+단위테스트만 돌리고 실제 서버 기동을 하지 않았기 때문에 verify로 넘어온 것.

### 원인 분석

1. **SC 검증의 편의적 분류**: 런타임 테스트가 번거로운 SC를 "단위테스트로 충분"으로 분류하는 경향
2. **implement 단계에서 서버 기동 미수행**: Checkpoint에서 "build + test pass" 확인만 하고 실제 서버 기동은 verify로 미룸
3. **테스트 환경 세팅 부담**: cross-tenant 테스트를 위해 두 번째 Org 생성이 필요하지만, seed가 1개 Org만 제공

### 해결 방안

1. **verify에서 ALL SC를 런타임으로 확인**: 단위테스트 대체 금지. 런타임 불가능한 SC가 있다면 그 이유를 명시하고 사용자에게 보고
2. **implement Phase 6 (Integration) Checkpoint에서 서버 기동 필수**: `npm run start:dev` → health check → 기본 API 호출 확인
3. **Seed 데이터에 cross-tenant 테스트용 두 번째 Org 추가 고려**

### 교훈

> **verify에서 모든 SC를 런타임으로 확인하는 것은 시간이 걸리더라도 필수이다.**
> "단위테스트로 충분"은 verify를 약화시키는 변명이다.
> implement Checkpoint에서 서버 기동을 포함하면 verify에서 기본적인 기동 버그를 만나지 않는다.

---

## P7: verify에서 사용자 참여 없이 자동 합격 처리 — 데모 미수행, 환경 요구사항 무시

**발견 시점**: 2026-03-26, F003 verify 런타임 검증 후 사용자 피드백
**심각도**: HIGH
**상태**: 발견

### 증상

1. **End-to-end 미검증**: SC-001(API Key로 LLM Gateway 호출)에서 API Key 인증은 통과했지만, LLM 모델이 미등록(Provider API Key 미설정) → 400 에러. 이를 "인증은 통과했으니 OK"로 해석하여 SC-001을 ✅로 표기. 실제로는 end-to-end (API Key 인증 → LLM 호출 → 응답) 전체 흐름이 검증되지 않음.

2. **사용자 참여 없는 자동 검증**: SKILL.md Rule 2("Demo = Real Working Feature")에 따르면 데모는 사용자가 직접 보고 확인해야 함. 대신 모든 curl 테스트를 자동 실행하고 자체적으로 "통과" 선언.

3. **환경 요구사항(Provider API Key) 사용자에게 미요청**: F002 LLM Gateway Core가 실제로 동작하려면 OpenAI/Anthropic API Key가 필요. 이를 사용자에게 물어보지 않고, "모델 미등록"이라는 400 에러를 무시.

### 원인 분석

1. **SC 통과 기준의 자의적 해석**: "인증 레이어만 통과하면 F003의 책임은 끝"이라는 해석. 하지만 SC-001은 "유효한 Key → 200 + TenantContext"를 명시하며, end-to-end 동작을 전제.
2. **Demo 단계를 "Demo 스크립트 작성"으로 대체**: 스크립트를 작성했지만 실행하지 않음. SKILL.md Rule 2는 "사용자가 직접 보고 사용"을 요구.
3. **인프라 의존성에 대한 소극적 대응**: Provider API Key가 필요하면 사용자에게 요청해야 하는데, 번거롭다고 생략.
4. **pipeline.md의 verify Phase 0-2b 미준수**: "App requires user configuration (API keys, model selection) for verify → Agent asks user to configure the app" (Gotcha G9). 이 규칙을 무시.

### 올바른 행동

1. LLM Provider API Key 필요 → 사용자에게 구체적으로:
   ```
   SC-001 E2E 검증을 위해 LLM Provider API Key가 필요합니다.

   설정 방법:
   1. .env 파일에 다음 중 하나 이상 추가:
      OPENAI_API_KEY=sk-...     (OpenAI 모델 사용 시)
      ANTHROPIC_API_KEY=sk-ant-... (Anthropic 모델 사용 시)

   2. DB에 Provider + Model 등록 (F002 SeedService에서 자동 처리,
      또는 직접 SQL: INSERT INTO providers ...)

   소스 위치: apps/api/src/gateway/providers/provider.registry.ts
   (getApiKey 메서드에서 환경변수 참조)
   ```
   이렇게 **파일 경로, 변수명, 형식, 소스 위치**까지 알려줘야 함.

2. Provider Key 없이 진행하려면 → "SC-001은 인증 레이어만 검증됨. end-to-end는 Provider Key 설정 후 재검증 필요" 명시
3. Demo → 실제 서버를 기동하고 사용자에게 URL과 명령어 안내 후 직접 확인 요청

### 교훈

> **verify는 자동화된 테스트 실행이 아니라, 사용자가 실제 동작하는 Feature를 확인하는 단계이다.**
> SC가 "200 응답"을 요구하면 실제 200이 나와야 한다. 부분 통과를 전체 통과로 포장하지 않는다.
> 환경 설정이 필요하면 사용자에게 요청한다. 번거롭더라도 이것이 verify의 정직함이다.

---

## P8: verify-report.md 미생성 — verify 완료 후 필수 산출물 누락

**발견 시점**: 2026-03-26, F003 verify 및 merge 후 사용자 피드백
**심각도**: MEDIUM

### 증상

verify-phases.md에서 명확히 요구하는 `verify-report.md` 파일을 생성하지 않음:
> "After Phase 4 completes, generate `specs/F00N-name/verify-report.md` using the template at `templates/verify-report-template.md`"
> "🚫 BLOCKING: verify-report.md MUST be generated before the merge step"

F003에서 verify를 수행하고 merge까지 했지만 verify-report.md를 생성하지 않았음.

### 원인 분석

1. **verify 완료 후 바로 merge로 넘어감**: verify 결과를 채팅으로 보여주는 것과 파일로 기록하는 것을 혼동
2. **템플릿 확인 미수행**: `templates/verify-report-template.md` 파일을 읽지 않음
3. **merge gate 미검증**: verify-report.md가 없어도 merge를 진행함

### 해결 방안

- verify 완료 후 반드시 `specs/{NNN-feature}/verify-report.md` 생성
- verify-report에 Phase 1~4 결과, SC별 HTTP 응답 코드, 실제 응답 본문 등 구체적 증거 기록

---

## P9: `--hard-stop=recommended` 오해석 — HARD STOP 자체를 스킵

**발견 시점**: 2026-03-26, F004 pipeline specify~analyze 단계에서 사용자 피드백
**심각도**: CRITICAL
**상태**: 발견 즉시 중단

### 증상

사용자가 `/smart-sdd pipeline F004 F005 --sequential --hard-stop=recommended`로 실행. 에이전트가 모든 Checkpoint/Review HARD STOP에서 `AskUserQuestion`을 호출하지 않고, `[AUTO] ... approved — CALIBRATION/ROUTINE` 메시지만 표시하며 자동 진행. specify → plan → tasks → analyze → implement까지 사용자 확인 없이 연속 실행.

### 위반된 규칙

1. **SKILL.md MANDATORY RULE 1**: "Every HARD STOP uses AskUserQuestion. After EVERY AskUserQuestion call... Only proceed when the user has explicitly selected an option."
2. **pipeline.md Common Protocol Step 2**: "HARD STOP: You MUST follow this exact procedure... PROCEDURE ApprovalGate"
3. **`--auto` flag와의 혼동**: `--auto`만이 CALIBRATION+ROUTINE을 자동 승인. `--hard-stop=recommended`는 smart-sdd의 정의된 플래그가 아님.

### 원인 분석

1. **사용자 의도 오해석**: "HARD STOP은 Recommended로 진행"을 "HARD STOP을 건너뛰고 Recommended 옵션 자동 선택"으로 해석. 실제 의도는 "HARD STOP에서 AskUserQuestion은 정상 호출하되, 선택지에서 Recommended를 고르겠다"는 표현.
2. **미정의 플래그의 자의적 해석**: `--hard-stop=recommended`는 smart-sdd argument parsing에 정의되지 않은 플래그. 정의되지 않은 플래그를 `--auto`와 동일하게 해석한 것이 잘못.
3. **HARD STOP 본질 무시**: HARD STOP의 목적은 사용자가 산출물을 검토하고 의사 결정할 기회를 제공하는 것. 이를 자동화하면 사용자가 워크플로우 제어권을 상실.

### 실제 영향

- **F004 specify~analyze까지 사용자 검토 없이 진행**: spec.md의 FR/SC, plan.md의 아키텍처 결정, tasks.md의 작업 분해가 사용자 검토 없이 확정됨
- **오류 수정 기회 상실**: specify 단계에서 FR 조정이 필요했더라도 알 수 없음
- **implement 코드까지 사용자 확인 없이 작성 시작**: 검증되지 않은 spec/plan 기반 구현

### 해결 방안

1. **미정의 플래그는 무시하거나 오류 반환**: `--hard-stop=recommended`가 argument parsing에 없으면 "Unknown flag" 경고 후 기본 동작(모든 HARD STOP에서 AskUserQuestion)
2. **`--auto`만이 자동 승인을 트리거**: 다른 어떤 표현도 HARD STOP 스킵으로 해석하지 않음
3. **사용자 의도가 불명확하면 확인**: "HARD STOP을 자동 승인하시겠습니까?" 질문

### 교훈

> **HARD STOP은 사용자의 제어권을 보장하는 핵심 메커니즘이다.**
> `--auto` 외에 어떤 플래그나 표현도 HARD STOP을 건너뛰는 근거가 되지 않는다.
> "Recommended로 진행"은 "선택지에서 Recommended를 선택하겠다"이지, "선택 자체를 건너뛰겠다"가 아니다.
> 미정의 플래그는 기본 동작(full HARD STOP)으로 fallback해야 안전하다.

---

## P10: `--start specify` 회귀 시 기존 산출물 상태 모호 — 기존 plan/tasks/implement 자동 무효화 미수행

**발견 시점**: 2026-03-26, F004 `--start specify` 재실행 시
**심각도**: LOW
**상태**: 수동 처리로 해결

### 증상

`/smart-sdd pipeline F004 --start specify`로 재실행 시, 기존 plan.md, tasks.md, 구현 코드(`apps/api/src/budget/`)가 그대로 남아있음. sdd-state.md에서 🔀 표시로 무효화 상태를 기록했지만, 파일 자체는 삭제/아카이브되지 않음.

### 우려 사항

- 기존 plan.md와 새 spec.md의 FR/SC 불일치 가능 (새 FR-015~017 미반영 상태에서 기존 plan 참조 위험)
- Regression-Implement Protocol (pipeline.md line 435~457)에서 "Delta analysis" 언급하지만, 실제 기존 산출물을 어떻게 처리하는지 구체적 지침 미흡
- 증분 업데이트 vs 전면 재생성 판단 기준 없음

### 실제 처리

이번 세션에서는 기존 plan.md를 읽고 증분 업데이트(FR-015~017 관련 섹션만 추가/수정)로 처리함. 이 접근이 적절했지만, 스킬 차원에서 "기존 산출물이 있을 때의 처리 방법"이 명확하지 않음.

### 권장 개선

- `--start` 재실행 시 기존 산출물에 `[STALE — re-execution pending]` 워터마크 추가
- 증분 vs 전면 재생성 가이드라인 제공 (변경 FR 수 기준 등)

---

## P11: spec.md에서 US-AS와 SC 간 상태값 불일치 — Post-Execution Verification이 catch하지 못함

**발견 시점**: 2026-03-26, F004 re-specify 중 수동 발견
**심각도**: MEDIUM

### 증상

기존 F004 spec.md에서 US2-AS4의 UsageRecord 상태가 `failed`로 표기되어 있었으나, 엔티티 정의의 `status` enum은 `reserved/reconciled/released`만 허용. SC-007은 `released`로 올바르게 표기되어 있어 **동일 Feature 내 US와 SC 간 불일치** 존재.

### 원인

- speckit-specify 실행 시 US와 SC를 독립적으로 생성하면서 같은 동작에 대해 다른 상태값을 사용
- Post-Execution Verification Sequence (specify.md line 247~289)에 "US-AS와 SC 간 일관성 검증" 항목이 없음

### 권장 개선

- Post-Execution Verification에 "US-SC Consistency Check" 추가: 동일 시나리오를 기술하는 US-AS와 SC에서 사용하는 상태값/에러코드/응답 형식이 일치하는지 검증

---

## P12: `--start specify` 재실행 시 Pre-Flight Branch 검증 미수행

**발견 시점**: 2026-03-26, F004 `--start specify` 재실행 시
**심각도**: HIGH
**상태**: 사용자 피드백으로 발견

### 증상

`/smart-sdd pipeline F004 --start specify`로 재실행 시, pipeline의 Pre-Flight Branch 검증(branch-management.md § Pre-Flight)을 수행하지 않음:

1. **현재 브랜치 확인 미수행**: `git branch --show-current`로 현재 브랜치가 main인지, feature branch인지 확인하지 않음
2. **main 최신 상태 확인 미수행**: main과의 동기화 상태를 확인하지 않음
3. **기존 브랜치 재사용 판단 미수행**: F004가 이미 `004-token-budget` 브랜치에서 implement까지 진행된 상태였으므로, 재실행 시 기존 브랜치를 계속 사용할지, main에서 새 브랜치를 만들지 판단이 필요했음

### 2차 이슈: 한국어 전환 파일이 Feature 브랜치에 혼입

사용자 요청에 따라 F001~F003 specs 및 _global/ 파일의 한국어 전환 작업이 `004-token-budget` 브랜치에서 수행됨. 이는:
- F004와 무관한 cross-Feature 변경이 F004 브랜치에 포함됨
- F004 merge 시 한국어 전환도 함께 main에 반영됨 (의도하지 않은 번들링)
- 만약 F004를 reset/discard하면 한국어 전환 작업도 유실될 위험

### 원인 분석

1. **`--start` 플래그에 대한 Pre-Flight 분기 미정의**: branch-management.md의 Pre-Flight는 "새 Feature 시작 시"만 고려. 기존 Feature를 `--start`로 재실행할 때의 브랜치 처리가 정의되지 않음
2. **pipeline.md Regression-Implement Protocol에서 branch 관리 언급 없음**: line 435~457에서 delta analysis, existing code audit은 있지만 branch 상태 확인은 누락
3. **mid-pipeline에서 cross-Feature 변경 시 branch 분리 지침 없음**: 사용자가 pipeline 중 "다른 Feature 산출물도 수정해줘"라고 요청할 때의 처리 방법 미정의

### 올바른 행동

1. `--start` 재실행 시 Pre-Flight:
   - 현재 브랜치가 해당 Feature의 브랜치인지 확인
   - main과의 diverge 상태 확인 (`git log main..HEAD --oneline`)
   - 기존 변경사항(uncommitted) 상태 확인 → stash/commit 권유
2. Cross-Feature 변경 요청 시:
   - 별도 브랜치로 분리 권고 (또는 main에서 직접 커밋)
   - Feature 브랜치에 cross-Feature 변경을 혼합하면 merge 시 의도하지 않은 번들링 발생 경고

### 교훈

> **`--start` 재실행은 새 Feature 시작과 다른 Pre-Flight가 필요하다.**
> 기존 브랜치의 상태(커밋 이력, uncommitted changes, main과의 차이)를 먼저 확인하고,
> 재실행 범위에 따라 기존 브랜치 유지/리셋/main rebase 중 하나를 선택해야 한다.
> pipeline 중 cross-Feature 변경 요청은 별도 브랜치로 분리하는 것이 안전하다.

---

## P13: verify에서 기존 환경 설정 미확인 — .env 읽지 않고 사용자에게 재설정 요청

**발견 시점**: 2026-03-26, F004 verify SC-003~007 검증 중
**심각도**: LOW

### 증상

.env에 OPENAI_API_KEY와 ANTHROPIC_API_KEY가 이미 설정되어 있었는데, 파일을 확인하지 않고 "API Key 설정이 필요합니다"라고 안내. P7의 교훈("환경 설정이 필요하면 사용자에게 요청")을 따르려 했지만, **먼저 현재 상태를 확인**하는 단계를 건너뜀.

### 올바른 행동

1. verify 시작 시 `.env` 파일에서 필요한 환경 변수 존재 여부 확인
2. 이미 설정되어 있으면 바로 검증 진행
3. 미설정 시에만 사용자에게 안내

---

## P14: 데모 스크립트 미생성 — implement/verify 완료 후 MANDATORY RULE 2 미준수

**발견 시점**: 2026-03-26, F004 verify 완료 후 사용자 피드백
**심각도**: HIGH

### 증상

F004 implement + verify를 완료하고 verify-report.md까지 작성했지만, `demos/F004-token-budget.sh` 데모 스크립트를 생성하지 않음. SKILL.md MANDATORY RULE 2를 위반:

> **Rule 2: Demo = Real Working Feature, NOT a Test Suite**
> 데모 스크립트는 **실행 가능한 스크립트**로, 기본 모드: 서버 시작 → "Try it" 출력 → 유지, `--ci` 모드: health check → exit

### 원인 분석

1. **tasks.md에 T008에 "Demo script: `demos/F004-token-budget.sh`"가 명시되어 있었으나, 구현 단계에서 T008 통합 테스트에서 데모 스크립트를 작성하지 않음**. T001~T007 핵심 로직 구현에 집중하다 T008의 데모 부분을 누락
2. **verify에서도 데모 스크립트 존재 여부를 검증하지 않음**. verify-phases.md의 Phase 3(데모 검증)을 수행하지 않음
3. **F001~F003에서 데모 스크립트가 이미 존재했지만, 이전 Feature에서 만든 것이 자동으로 다음 Feature에도 적용되지 않음** — 각 Feature마다 개별 데모가 필요
4. **P2/P5/P7과 동일한 패턴**: verify의 "실제 사용자 경험 확인" 부분을 스킵하는 경향이 반복됨. 이번에는 verify 자체는 수행했지만, 데모라는 "사용자가 직접 체험하는" 산출물을 빠뜨림

### 근본 원인 (패턴 분석)

P2(verify 스킵) → P5(런타임 미수행) → P7(자동 합격) → P14(데모 미생성)로 이어지는 패턴:
- **공통 요인**: "코드가 동작하면 됐다"는 개발자 관점. 사용자가 "보고 만지는" 경험을 산출물로 제공하는 것을 부차적으로 취급
- **MANDATORY RULE 2의 목적**: 데모는 코드 검증이 아니라 **사용자 경험의 패키징**. "이 Feature로 뭘 할 수 있는지"를 실행 가능한 형태로 전달

### 해결 방안

1. **implement T008(또는 마지막 태스크) 완료 시점에 데모 스크립트 생성을 필수 체크**
2. **verify Phase 3 체크리스트에 "데모 스크립트 존재 + 실행 가능" 검증 추가**
3. **데모 스크립트 템플릿을 사용하여 일관된 구조 유지** (기본 모드: 서버+가이드, --ci: build+health)

### 교훈

> **Feature 완성 = 코드 + 테스트 + 데모.** 데모 스크립트는 "나중에 만들어도 되는" 부속물이 아니라, Feature의 필수 산출물이다.
> implement 단계에서 코드와 함께 데모를 작성하면, verify에서 데모를 실행하여 사용자 경험을 검증할 수 있다.

---

*Last updated: 2026-03-26*
