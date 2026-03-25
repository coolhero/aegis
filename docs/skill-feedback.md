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

*Last updated: 2026-03-25*
