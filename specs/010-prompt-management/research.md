# Research: F010 — Prompt Management

## 기술 조사

### 변수 치환 패턴

**선택**: 단순 `{{var}}` + `{{var|default}}` 정규식 파싱
**대안 검토**:
- Mustache/Handlebars — 과잉. helpers, partials, loops 불필요. 외부 의존성 추가
- Template literals (ES6) — 보안 위험 (코드 주입), 서버 사이드 평가 부적합
- EJS/Nunjucks — 템플릿 엔진은 HTML 용도. 프롬프트 텍스트에는 불필요

**결론**: 정규식 `\{\{(\w+)(?:\|([^}]*))?\}\}` 하나로 충분. 외부 의존성 없음.

### A/B 트래픽 분할

**선택**: Weighted random (Math.random() * 100 + 누적 가중치)
**이유**:
- 요청 단위 stateless 분할 — 세션 유지 불필요
- 충분한 표본 (100+ 요청)에서 ±5% 이내 수렴
- 복잡한 해싱(consistent hashing) 불필요 — 사용자별 일관성 요구사항 없음

### 버전 관리 전략

**선택**: version_number (integer, template 내 자동 증가) + DB unique constraint
**대안**: Git SHA-like hash — 과잉. 프롬프트 이력은 선형적.
**동시 수정**: DB unique(template_id, version_number)로 충돌 방지. MAX(version_number) + 1로 새 버전 생성.

## 미해결 항목

없음. 모든 기술 결정 완료.
