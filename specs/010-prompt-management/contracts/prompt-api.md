# API Contract: F010 — Prompt Management

## POST /prompts

프롬프트 템플릿 생성.

**Auth**: AuthGuard (admin, member)
**Tenant**: TenantContext (org_id 자동 설정)

**Request**:
```json
{
  "name": "Customer Support Prompt",
  "description": "고객 지원용 프롬프트",
  "content": "{{role}}님, {{topic}}에 대해 {{lang|한국어}}로 답변해주세요."
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "name": "Customer Support Prompt",
  "description": "고객 지원용 프롬프트",
  "variables": [
    { "name": "role", "required": true, "default_value": null },
    { "name": "topic", "required": true, "default_value": null },
    { "name": "lang", "required": false, "default_value": "한국어" }
  ],
  "active_version_id": "uuid",
  "status": "draft",
  "created_at": "2026-03-27T..."
}
```

**Errors**: 401 (미인증), 403 (viewer), 413 (content > 100,000자)

---

## GET /prompts

프롬프트 목록 조회 (테넌트 격리).

**Auth**: AuthGuard (all roles)
**Query Params**: `page` (default 1), `limit` (default 20), `sort` (name/created_at/call_count), `order` (asc/desc), `status` (draft/published/archived)

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Customer Support Prompt",
      "status": "published",
      "active_version_id": "uuid",
      "created_at": "..."
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

---

## GET /prompts/:id

프롬프트 상세 조회.

**Auth**: AuthGuard (all roles)

**Response** (200): PromptTemplate 전체 필드 + active_version 내용 포함
**Errors**: 404 (미존재 또는 타 org)

---

## PUT /prompts/:id

프롬프트 수정 (새 버전 자동 생성).

**Auth**: AuthGuard (admin, member)

**Request**:
```json
{
  "content": "새로운 프롬프트 내용...",
  "change_note": "변수 추가 및 문구 개선"
}
```

**Response** (200): 업데이트된 PromptTemplate + 새 PromptVersion

---

## GET /prompts/:id/versions

버전 이력 조회.

**Auth**: AuthGuard (all roles)

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "version_number": 3,
      "content": "프롬프트 내용...",
      "change_note": "문구 개선",
      "created_by": "uuid",
      "created_at": "..."
    }
  ]
}
```

---

## POST /prompts/:id/publish

특정 버전을 활성 버전으로 배포.

**Auth**: AuthGuard (admin, member)

**Request**:
```json
{
  "version": 2
}
```

**Response** (200): 업데이트된 PromptTemplate (active_version_id = v2, status = 'published')
**Errors**: 404 (버전 미존재)

---

## POST /prompts/:id/rollback

이전 버전으로 롤백. 활성 A/B 테스트 자동 종료.

**Auth**: AuthGuard (admin, member)

**Request**:
```json
{
  "target_version": 1
}
```

**Response** (200): 업데이트된 PromptTemplate (active_version_id = v1) + A/B 테스트 종료 정보
**Errors**: 404 (버전 미존재)

---

## POST /prompts/:id/ab-test

A/B 테스트 설정. published 프롬프트에서만 가능.

**Auth**: AuthGuard (admin, member)

**Request**:
```json
{
  "variants": [
    { "version_id": "uuid-v2", "weight": 70 },
    { "version_id": "uuid-v3", "weight": 30 }
  ]
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "template_id": "uuid",
  "status": "active",
  "variants": [
    { "id": "uuid", "version_id": "uuid-v2", "weight": 70, "call_count": 0, "total_tokens": 0 },
    { "id": "uuid", "version_id": "uuid-v3", "weight": 30, "call_count": 0, "total_tokens": 0 }
  ]
}
```

**Errors**: 400 (가중치 합 ≠ 100, draft/archived 프롬프트), 409 (이미 활성 A/B 테스트 존재)

---

## GET /prompts/:id/ab-test/stats

활성 A/B 테스트 통계.

**Auth**: AuthGuard (all roles)

**Response** (200):
```json
{
  "ab_test_id": "uuid",
  "status": "active",
  "variants": [
    { "variant_id": "uuid", "version_id": "uuid-v2", "weight": 70, "call_count": 65, "total_tokens": 12500 },
    { "variant_id": "uuid", "version_id": "uuid-v3", "weight": 30, "call_count": 35, "total_tokens": 7200 }
  ]
}
```

**Errors**: 404 (활성 A/B 테스트 없음)

---

## DELETE /prompts/:id/ab-test

A/B 테스트 종료.

**Auth**: AuthGuard (admin, member)

**Response** (200): `{ message: "A/B test ended", ab_test_id: "uuid" }`

---

## POST /prompts/:id/resolve

프롬프트 해결 — 활성 버전 또는 A/B 변형 선택 + 변수 치환.

**Auth**: AuthGuard (all roles, viewer 포함)

**Request**:
```json
{
  "variables": {
    "role": "전문가",
    "topic": "AI 보안"
  }
}
```

**Response** (200):
```json
{
  "text": "전문가님, AI 보안에 대해 한국어로 답변해주세요.",
  "version_id": "uuid",
  "variant_id": "uuid (nullable)"
}
```

**Headers**: `X-Prompt-Variant: uuid` (A/B 테스트 활성 시)

**Errors**: 400 (missing_variables, prompt_not_published), 404 (미존재/타 org)

---

## GET /prompts/:id/stats

프롬프트 사용 통계.

**Auth**: AuthGuard (all roles)

**Response** (200):
```json
{
  "template_id": "uuid",
  "call_count": 150,
  "total_tokens": 45000,
  "last_used_at": "2026-03-27T..."
}
```

---

## DELETE /prompts/:id

프롬프트 삭제 (cascade: versions, ab-tests, stats).

**Auth**: AuthGuard (admin)

**Response** (200): `{ message: "Prompt deleted" }`
