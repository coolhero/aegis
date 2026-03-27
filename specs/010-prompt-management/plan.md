# Implementation Plan: F010 — Prompt Management

**Branch**: `010-prompt-management` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)

## Summary

프롬프트 버전 관리, 변수 치환 템플릿, A/B 테스팅, 해결(resolve) API를 NestJS 백엔드에 추가한다. 5개 신규 엔티티 (PromptTemplate, PromptVersion, AbTest, AbTestVariant, PromptUsageStat), 10+ API 엔드포인트, 변수 파서를 구현한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer
**Storage**: PostgreSQL (프롬프트, 버전, A/B 테스트, 통계)
**Testing**: Jest + Supertest
**Project Type**: Backend service module (`apps/api/src/prompt/`)
**Performance Goals**: resolve < 50ms (DB 조회 + 변수 치환), A/B 분할 O(1)
**Constraints**: 변수 파싱은 `{{var}}`, `{{var|default}}` 패턴만. Mustache 전체 구문 미지원.

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| Tenant Data Isolation | ✅ 모든 엔티티에 org_id. AuthGuard + TenantContext 적용 |
| Start Simple (YAGNI) | ✅ 단순 `{{var}}` 패턴. Mustache/Handlebars 미지원. A/B 테스트는 가중치 기반 |
| Audit Trail | ✅ 버전 이력 불변 (version_number 자동 증가). 사용 통계 추적 |
| Secure Token Storage | N/A (프롬프트에 민감 정보 없음) |

## Project Structure

```text
apps/api/src/prompt/
├── prompt.module.ts              # NestJS 모듈
├── prompt-template.entity.ts     # PromptTemplate TypeORM 엔티티
├── prompt-version.entity.ts      # PromptVersion TypeORM 엔티티
├── ab-test.entity.ts             # AbTest TypeORM 엔티티
├── ab-test-variant.entity.ts     # AbTestVariant TypeORM 엔티티
├── prompt-usage-stat.entity.ts   # PromptUsageStat TypeORM 엔티티
├── prompt.controller.ts          # CRUD + publish + rollback + resolve
├── prompt.service.ts             # 프롬프트 CRUD + 버전 관리
├── prompt-version.service.ts     # 버전 생성/조회/롤백
├── ab-test.service.ts            # A/B 테스트 설정/통계/종료
├── prompt-resolver.service.ts    # 해결 로직 (버전 선택 + 변수 치환 + A/B 분할)
├── variable-parser.service.ts    # {{var}} 패턴 파싱 + 치환
├── prompt-stats.service.ts       # 사용 통계 추적
├── dto/
│   ├── create-prompt.dto.ts
│   ├── update-prompt.dto.ts
│   ├── publish-prompt.dto.ts
│   ├── rollback-prompt.dto.ts
│   ├── create-ab-test.dto.ts
│   └── resolve-prompt.dto.ts
└── __tests__/
    ├── prompt.service.spec.ts
    ├── variable-parser.spec.ts
    ├── ab-test.service.spec.ts
    └── prompt-resolver.spec.ts
```

## Architecture

### 프롬프트 버전 관리 플로우

```
POST /prompts { name, description, content }
  → PromptService.create(dto, tenantContext)
  → DB에 PromptTemplate 저장 (status: draft, org_id)
  → VariableParser.extract(content) → variables 필드 자동 설정
  → PromptVersionService.createVersion(template, content, "Initial version")
  → active_version_id = v1
  → 201 Created

PUT /prompts/:id { content, change_note }
  → PromptService.update(id, dto, tenantContext)
  → VariableParser.extract(newContent) → variables 업데이트
  → PromptVersionService.createVersion(template, newContent, change_note)
  → 200 OK (active_version은 변경하지 않음 — publish로 별도 설정)
```

### 변수 치환 엔진

```
VariableParser.extract(content):
  regex: /\{\{(\w+)(?:\|([^}]*))?\}\}/g
  결과: [{ name: "role", required: true }, { name: "lang", required: false, default: "ko" }]

VariableParser.resolve(content, variables, providedValues):
  1. extract()로 변수 목록 추출
  2. 필수 변수 (default 없음) 중 providedValues에 없는 것 → missing 목록
  3. missing.length > 0 → throw MissingVariablesException(missing)
  4. 각 변수에 대해:
     - providedValues에 있으면 → 치환
     - 없으면 → default 값 사용
  5. 치환된 최종 텍스트 반환
```

### A/B 테스트 트래픽 분할

```
PromptResolverService.resolve(templateId, variables, tenantContext):
  1. template = findOne(id, orgId)
  2. if template.status !== 'published' → 400 prompt_not_published
  3. abTest = abTestService.findActive(templateId)
  4. if abTest:
     → rand = Math.random() * 100
     → 가중치 누적으로 변형 선택 (예: 70:30 → [0,70)=v1, [70,100)=v2)
     → selectedVersion = variant.version
     → abTestVariant.call_count++, total_tokens++ (비동기 업데이트)
  5. else:
     → selectedVersion = template.active_version
  6. resolved = variableParser.resolve(selectedVersion.content, variables)
  7. promptStats.recordUsage(templateId)
  8. return { text: resolved, version_id, variant_id? }
```

### RBAC 규칙

| Role | CRUD | Publish/Rollback | A/B Test | Resolve | Stats |
|------|------|-----------------|----------|---------|-------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| member | ✅ | ✅ | ✅ | ✅ | ✅ |
| viewer | 조회만 | ❌ | ❌ | ✅ | ✅ |

## Complexity Tracking

해당 없음. Constitution 위반 없음.
