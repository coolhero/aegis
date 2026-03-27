# Entity Registry — AEGIS

> Feature 간 공유 데이터 모델. `speckit-plan` 실행 시 채워짐.

| Entity | Owner Feature | Key Fields | Referenced By |
|--------|--------------|------------|---------------|
| AppConfig | F001 | `id`, `key`, `value`, `environment`, `created_at` | F002, F003, F004, F005, F006, F007, F008 |
| Provider | F002 | `id`, `name`, `type` (openai/anthropic), `api_key_encrypted`, `base_url`, `enabled`, `health_status`, `weight` | F005, F006, F008, F009, F011 |
| Model | F002 | `id`, `provider_id`, `name`, `display_name`, `input_price_per_token`, `output_price_per_token`, `max_tokens`, `enabled` | F005, F008, F009, F010, F011, F012 |
| GatewayRequest | F002 | `id`, `trace_id`, `tenant_id`, `user_id`, `model_id`, `provider_id`, `status`, `created_at` | F005, F006, F010, F011 |
| Organization | F003 | `id`, `name`, `slug`, `plan`, `settings` (jsonb), `created_at`, `updated_at` | F004, F005, F006, F007, F009, F010, F011, F012 |
| Team | F003 | `id`, `org_id` (FK), `name`, `slug`, `created_at`, `updated_at` | F004, F005, F007, F010 |
| User | F003 | `id`, `org_id` (FK), `team_id` (FK, nullable), `email` (unique), `name`, `password_hash`, `role` (admin/member/viewer), `refresh_token_hash`, `created_at`, `updated_at` | F004, F005, F007, F012 |
| ApiKey | F003 | `id`, `org_id` (FK), `user_id` (FK), `key_hash` (unique), `key_prefix`, `name`, `scopes` (jsonb), `last_used_at`, `expires_at`, `revoked`, `created_at` | F007 |
| Budget | F004 | `id`, `level` (org/team/user), `target_id`, `org_id`, `token_limit`, `cost_limit_usd`, `alert_thresholds` (jsonb), `period_type`, `webhook_url`, `enabled`, `current_period_id` | F007 |
| BudgetPeriod | F004 | `id`, `budget_id`, `start_date`, `end_date`, `total_tokens_used`, `total_cost_usd`, `is_active` | F007 |
| UsageRecord | F004 | `id`, `budget_id`, `period_id`, `request_id`, `idempotency_key`, `model_id`, `input_tokens`, `output_tokens`, `estimated_tokens`, `cost_usd`, `status` (reserved/reconciled/released) | F007 |
| AlertRecord | F004 | `id`, `budget_id`, `period_id`, `threshold`, `usage_pct`, `webhook_status` | F007 |
| ModelTier | F004 | `id`, `org_id`, `name`, `description` | F007 |
| ModelTierMember | F004 | `id`, `tier_id`, `model_id` | — |
| RequestLog | F005 | `id`, `request_id` (unique), `trace_id`, `org_id` (FK), `user_id` (FK), `team_id` (FK, nullable), `model`, `provider`, `input_masked`, `output_masked`, `input_tokens`, `output_tokens`, `cost_usd` (decimal), `latency_ms`, `status`, `error_detail`, `cache_hit`, `estimated`, `langfuse_trace_id`, `input_size`, `output_size`, `created_at` | F007 |
| SecurityPolicy | F006 | `id`, `org_id`, `pii_categories`, `pii_action` (mask/reject/warn), `injection_defense_enabled`, `content_filter_categories`, `bypass_roles`, `updated_at` | — |
| GuardResult | F006 | `id`, `request_id`, `scanner_type`, `decision` (pass/block/mask), `details`, `latency_ms`, `created_at` | — |
| Document | F009 | `id`, `org_id`, `title`, `content_type`, `chunk_count`, `embedding_status` (pending/processing/done/failed), `created_at` | — |
| Embedding | F009 | `id`, `document_id`, `chunk_index`, `content`, `vector` (pgvector), `metadata`, `created_at` | — |
| McpServer | F009 | `id`, `org_id`, `name`, `url`, `protocol_version`, `tools`, `enabled`, `health_status` | — |
| PromptTemplate | F010 | `id`, `org_id`, `name`, `description`, `variables` (jsonb), `active_version_id`, `status` (draft/published/archived), `created_by`, `created_at`, `updated_at` | F012 |
| PromptVersion | F010 | `id`, `template_id`, `version_number`, `content`, `change_note`, `created_by`, `created_at` | F012 |
| AbTest | F010 | `id`, `template_id`, `status` (active/completed), `created_at`, `ended_at` | — |
| AbTestVariant | F010 | `id`, `ab_test_id`, `version_id`, `weight`, `call_count`, `total_tokens` | — |
| PromptUsageStat | F010 | `id`, `template_id` (unique), `call_count`, `total_tokens`, `last_used_at` | — |
| CacheEntry | F011 | `id`, `org_id`, `model`, `query_hash`, `query_vector` (pgvector), `response`, `tokens_saved`, `hit_count`, `ttl`, `created_at`, `expires_at` | — |
