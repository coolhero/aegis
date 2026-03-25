# Data Model: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25
**Phase**: 1 (Design)

## Entities

### Provider

LLM provider configuration entity. Stores connection details, health status, and routing weight for each supported provider (OpenAI, Anthropic).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `name` | varchar | NOT NULL, UNIQUE | Human-readable provider name (e.g., `"openai"`, `"anthropic"`) |
| `type` | enum | NOT NULL | Provider type enum: `'openai'` \| `'anthropic'` |
| `api_key_encrypted` | varchar | NULLABLE | Encrypted API key (nullable for providers using env-based keys) |
| `base_url` | varchar | NULLABLE | Custom base URL override (e.g., Azure OpenAI endpoint) |
| `enabled` | boolean | NOT NULL, default: `true` | Whether this provider is active for routing |
| `health_status` | varchar | NOT NULL, default: `'unknown'` | Last known health: `'healthy'` \| `'degraded'` \| `'unhealthy'` \| `'unknown'` |
| `weight` | integer | NOT NULL, default: `1` | Routing weight for load balancing (F008, future) |
| `created_at` | timestamp | NOT NULL, auto-set | Record creation timestamp |
| `updated_at` | timestamp | NOT NULL, auto-set | Last update timestamp |

**TypeORM Entity**:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: ProviderType })
  type: ProviderType;

  @Column({ name: 'api_key_encrypted', nullable: true })
  apiKeyEncrypted: string;

  @Column({ name: 'base_url', nullable: true })
  baseUrl: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'health_status', default: 'unknown' })
  healthStatus: string;

  @Column({ type: 'int', default: 1 })
  weight: number;

  @OneToMany(() => Model, (model) => model.provider)
  models: Model[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### Model

LLM model configuration entity. Maps client-facing model names to provider-specific models with pricing and capability metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `provider_id` | UUID | FK -> `providers.id`, NOT NULL | Owning provider |
| `name` | varchar | NOT NULL, UNIQUE | Client-facing model name (e.g., `"gpt-4o"`, `"claude-sonnet-4-20250514"`) |
| `display_name` | varchar | NOT NULL | Human-readable display name |
| `input_price_per_token` | decimal(20,12) | NOT NULL, default: `0` | Cost per input token (USD) |
| `output_price_per_token` | decimal(20,12) | NOT NULL, default: `0` | Cost per output token (USD) |
| `max_tokens` | integer | NOT NULL, default: `4096` | Maximum output tokens supported |
| `context_window` | integer | NOT NULL, default: `128000` | Maximum context window size (input + output) |
| `enabled` | boolean | NOT NULL, default: `true` | Whether this model is available for requests |
| `created_at` | timestamp | NOT NULL, auto-set | Record creation timestamp |
| `updated_at` | timestamp | NOT NULL, auto-set | Last update timestamp |

**TypeORM Entity**:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Provider } from './provider.entity';

@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => Provider, (provider) => provider.models)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({
    name: 'input_price_per_token',
    type: 'decimal',
    precision: 20,
    scale: 12,
    default: 0,
  })
  inputPricePerToken: number;

  @Column({
    name: 'output_price_per_token',
    type: 'decimal',
    precision: 20,
    scale: 12,
    default: 0,
  })
  outputPricePerToken: number;

  @Column({ name: 'max_tokens', type: 'int', default: 4096 })
  maxTokens: number;

  @Column({ name: 'context_window', type: 'int', default: 128000 })
  contextWindow: number;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### GatewayRequest (Runtime Context — Not Persisted)

In-memory request context used during request processing. Not a database entity. Tracks the lifecycle of a single gateway request for token counting, error handling, and future logging (F005).

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string (UUID) | Unique request identifier |
| `model` | string | Requested model name |
| `provider` | ProviderType | Resolved provider type |
| `stream` | boolean | Whether streaming was requested |
| `promptTokens` | number | Input token count (from provider usage) |
| `completionTokens` | number | Output token count (from provider usage) |
| `totalTokens` | number | Total tokens (prompt + completion) |
| `startedAt` | Date | Request start timestamp |
| `completedAt` | Date \| null | Request completion timestamp |
| `error` | string \| null | Error message if request failed |
| `tokensStreamed` | number | Tokens successfully streamed before error (for mid-stream failures) |

**TypeScript Interface**:

```typescript
import { ProviderType } from './provider.entity';

export interface GatewayRequestContext {
  requestId: string;
  model: string;
  provider: ProviderType;
  stream: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  tokensStreamed: number;
}
```

---

## Indexes

| Entity | Index Name | Columns | Type | Purpose |
|--------|-----------|---------|------|---------|
| Provider | `UQ_providers_name` | `(name)` | UNIQUE | Prevent duplicate provider names |
| Provider | `IDX_providers_type` | `(type)` | INDEX | Fast lookup by provider type |
| Provider | `IDX_providers_enabled` | `(enabled)` | INDEX | Filter active providers |
| Model | `UQ_models_name` | `(name)` | UNIQUE | Prevent duplicate model names |
| Model | `IDX_models_provider_id` | `(provider_id)` | INDEX | FK index for provider relation |
| Model | `IDX_models_enabled` | `(enabled)` | INDEX | Filter active models |

## Relationships

```
Provider (1) ----< (N) Model
  - One provider has many models
  - Each model belongs to exactly one provider
  - FK: models.provider_id -> providers.id
  - Cascade: none (deleting provider requires removing models first)
```

## Seed Data

Initial seed data for development and testing:

```typescript
// Provider seeds
const providers = [
  {
    name: 'openai',
    type: ProviderType.OPENAI,
    enabled: true,
    healthStatus: 'unknown',
  },
  {
    name: 'anthropic',
    type: ProviderType.ANTHROPIC,
    enabled: true,
    healthStatus: 'unknown',
  },
];

// Model seeds
const models = [
  {
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    inputPricePerToken: 0.0000025,   // $2.50/1M tokens
    outputPricePerToken: 0.00001,    // $10.00/1M tokens
    maxTokens: 16384,
    contextWindow: 128000,
  },
  {
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    inputPricePerToken: 0.00000015,  // $0.15/1M tokens
    outputPricePerToken: 0.0000006,  // $0.60/1M tokens
    maxTokens: 16384,
    contextWindow: 128000,
  },
  {
    name: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    inputPricePerToken: 0.000003,    // $3.00/1M tokens
    outputPricePerToken: 0.000015,   // $15.00/1M tokens
    maxTokens: 8192,
    contextWindow: 200000,
  },
  {
    name: 'claude-haiku-3-5',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    inputPricePerToken: 0.0000008,   // $0.80/1M tokens
    outputPricePerToken: 0.000004,   // $4.00/1M tokens
    maxTokens: 8192,
    contextWindow: 200000,
  },
];
```

## Migration Strategy

- **Initial migration**: Creates `providers` and `models` tables with all columns, indexes, and FK constraint.
- **Seed migration**: Inserts default provider and model records.
- **Migration command**: `npm run migration:generate -- -n CreateProvidersAndModels`
- **Run command**: `npm run migration:run`
- **Auto-sync**: Enabled only in `development` environment. Disabled in `staging` and `production`.

## Notes

- The `api_key_encrypted` column stores encrypted API keys. In development, env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are used directly via ConfigService. The column is reserved for multi-tenant key management (F003).
- The `weight` column on Provider is reserved for future load balancing (F008). Default value of 1 means equal weight.
- `GatewayRequestContext` is intentionally not persisted. Request logging (F005) will introduce a persistent `GatewayLog` entity that captures a subset of this context.
- `context_window` on Model is informational. Actual context limit enforcement is deferred to F004 (Token Budget).
