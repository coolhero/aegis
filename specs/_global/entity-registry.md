# Entity Registry — AEGIS

> Shared data models across Features. Populated during `speckit-plan`.

| Entity | Owner Feature | Key Fields | Referenced By |
|--------|--------------|------------|---------------|
| AppConfig | F001 | `id`, `key`, `value`, `environment`, `created_at` | F002, F003, F004, F005, F006, F007, F008 |
| Provider | F002 | `id`, `name`, `type` (openai/anthropic), `api_key_encrypted`, `base_url`, `enabled`, `health_status`, `weight` | F005, F006, F008, F009, F011 |
| Model | F002 | `id`, `provider_id`, `name`, `display_name`, `input_price_per_token`, `output_price_per_token`, `max_tokens`, `enabled` | F005, F008, F009, F010, F011, F012 |
| GatewayRequest | F002 | `id`, `trace_id`, `tenant_id`, `user_id`, `model_id`, `provider_id`, `status`, `created_at` | F005, F006, F010, F011 |
| Organization | F003 | `id`, `name`, `slug`, `plan`, `settings`, `created_at` | F004, F005, F006, F007, F009, F010, F011, F012 |
| Team | F003 | `id`, `org_id`, `name`, `slug`, `created_at` | F004, F005, F007, F010 |
| User | F003 | `id`, `org_id`, `team_id`, `email`, `name`, `role` (admin/member/viewer), `created_at` | F004, F005, F007, F012 |
| ApiKey | F003 | `id`, `org_id`, `user_id`, `key_hash`, `name`, `scopes`, `last_used_at`, `expires_at`, `revoked` | F007 |
| Budget | F004 | `id`, `level` (org/team/user), `target_id`, `token_limit`, `cost_limit_usd`, `soft_limit_pct`, `hard_limit_pct`, `period` (monthly), `current_period_id` | F007 |
| UsageRecord | F004 | `id`, `budget_id`, `period_id`, `request_id`, `input_tokens`, `output_tokens`, `cost_usd`, `created_at` | F007 |
| RequestLog | F005 | `id`, `request_id`, `trace_id`, `tenant_id`, `user_id`, `model`, `provider`, `input_masked`, `output_masked`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `status`, `cache_hit`, `created_at` | F007 |
| SecurityPolicy | F006 | `id`, `org_id`, `pii_categories`, `pii_action` (mask/reject/warn), `injection_defense_enabled`, `content_filter_categories`, `bypass_roles`, `updated_at` | — |
| GuardResult | F006 | `id`, `request_id`, `scanner_type`, `decision` (pass/block/mask), `details`, `latency_ms`, `created_at` | — |
| Document | F009 | `id`, `org_id`, `title`, `content_type`, `chunk_count`, `embedding_status` (pending/processing/done/failed), `created_at` | — |
| Embedding | F009 | `id`, `document_id`, `chunk_index`, `content`, `vector` (pgvector), `metadata`, `created_at` | — |
| McpServer | F009 | `id`, `org_id`, `name`, `url`, `protocol_version`, `tools`, `enabled`, `health_status` | — |
| PromptTemplate | F010 | `id`, `org_id`, `name`, `description`, `variables`, `active_version_id`, `status` (draft/published/archived), `created_at` | F012 |
| PromptVersion | F010 | `id`, `template_id`, `version_number`, `content`, `change_note`, `created_by`, `created_at` | F012 |
| CacheEntry | F011 | `id`, `org_id`, `model`, `query_hash`, `query_vector` (pgvector), `response`, `tokens_saved`, `hit_count`, `ttl`, `created_at`, `expires_at` | — |
