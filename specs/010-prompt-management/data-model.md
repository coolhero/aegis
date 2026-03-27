# Data Model: F010 — Prompt Management

## PromptTemplate

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | 고유 식별자 |
| org_id | uuid | FK → Organization, NOT NULL | 소속 조직 (테넌트 격리) |
| name | varchar(255) | NOT NULL | 프롬프트 이름 |
| description | text | nullable | 프롬프트 설명 |
| variables | jsonb | NOT NULL, default '[]' | 자동 추출된 변수 메타데이터 `[{ name, required, default_value }]` |
| active_version_id | uuid | FK → PromptVersion, nullable | 현재 활성 버전 |
| status | varchar(20) | NOT NULL, default 'draft' | 'draft' / 'published' / 'archived' |
| created_by | uuid | FK → User, NOT NULL | 생성자 |
| created_at | timestamp | NOT NULL, default now() | 생성 시간 |
| updated_at | timestamp | NOT NULL, default now() | 수정 시간 |

**Indexes**:
- `idx_prompt_template_org_id` ON (org_id)
- `idx_prompt_template_status` ON (org_id, status)

**State Transitions**: draft → published (publish), published → archived (archive), archived → draft (새 버전 생성 시)

---

## PromptVersion

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | 고유 식별자 |
| template_id | uuid | FK → PromptTemplate, NOT NULL, ON DELETE CASCADE | 소속 템플릿 |
| version_number | integer | NOT NULL | 자동 증가 버전 번호 |
| content | text | NOT NULL, max 100,000 chars | 프롬프트 본문 |
| change_note | varchar(500) | nullable | 변경 사유 |
| created_by | uuid | FK → User, NOT NULL | 작성자 |
| created_at | timestamp | NOT NULL, default now() | 생성 시간 |

**Indexes**:
- `idx_prompt_version_template` ON (template_id, version_number DESC)
- UNIQUE (template_id, version_number)

---

## AbTest

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | 고유 식별자 |
| template_id | uuid | FK → PromptTemplate, NOT NULL | 대상 프롬프트 |
| status | varchar(20) | NOT NULL, default 'active' | 'active' / 'completed' |
| created_at | timestamp | NOT NULL, default now() | 시작 시간 |
| ended_at | timestamp | nullable | 종료 시간 |

**Indexes**:
- `idx_ab_test_template_active` ON (template_id) WHERE status = 'active' (partial index, 유일성 보장)

**Constraint**: 프롬프트당 활성 A/B 테스트 최대 1개 (partial unique index)

---

## AbTestVariant

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | 고유 식별자 |
| ab_test_id | uuid | FK → AbTest, NOT NULL, ON DELETE CASCADE | 소속 A/B 테스트 |
| version_id | uuid | FK → PromptVersion, NOT NULL | 프롬프트 버전 |
| weight | integer | NOT NULL, CHECK (weight > 0 AND weight <= 100) | 트래픽 가중치 (%) |
| call_count | integer | NOT NULL, default 0 | 호출 수 |
| total_tokens | bigint | NOT NULL, default 0 | 총 토큰 사용량 |

**Indexes**:
- `idx_ab_test_variant_test` ON (ab_test_id)

---

## PromptUsageStat

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | 고유 식별자 |
| template_id | uuid | FK → PromptTemplate, NOT NULL, UNIQUE | 대상 프롬프트 |
| call_count | integer | NOT NULL, default 0 | 총 호출 수 |
| total_tokens | bigint | NOT NULL, default 0 | 총 토큰 사용량 |
| last_used_at | timestamp | nullable | 마지막 사용 시간 |

**Indexes**:
- UNIQUE (template_id)

---

## Entity Relationship

```
Organization (F003)
  └── PromptTemplate (1:N)
        ├── PromptVersion (1:N, cascade delete)
        ├── AbTest (1:N)
        │     └── AbTestVariant (1:N, cascade delete)
        │           └── → PromptVersion (N:1)
        └── PromptUsageStat (1:1)
```
