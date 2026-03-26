# Data Model: F002 — LLM Gateway Core

**Feature**: F002 — LLM Gateway Core
**Date**: 2025-03-25
**Phase**: 1 (설계)

## Entities

### Provider

LLM 프로바이더 구성 엔티티. 지원되는 각 프로바이더(OpenAI, Anthropic)에 대한 연결 세부사항, 헬스 상태, 라우팅 가중치를 저장한다.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `name` | varchar | NOT NULL, UNIQUE | 사람이 읽을 수 있는 프로바이더 이름 (예: `"openai"`, `"anthropic"`) |
| `type` | enum | NOT NULL | 프로바이더 타입 enum: `'openai'` \| `'anthropic'` |
| `api_key_encrypted` | varchar | NULLABLE | 암호화된 API 키 (env 기반 키를 사용하는 프로바이더의 경우 nullable) |
| `base_url` | varchar | NULLABLE | 커스텀 base URL 오버라이드 (예: Azure OpenAI 엔드포인트) |
| `enabled` | boolean | NOT NULL, default: `true` | 이 프로바이더가 라우팅에 활성화되어 있는지 여부 |
| `health_status` | varchar | NOT NULL, default: `'unknown'` | 마지막으로 알려진 헬스 상태: `'healthy'` \| `'degraded'` \| `'unhealthy'` \| `'unknown'` |
| `weight` | integer | NOT NULL, default: `1` | 로드 밸런싱을 위한 라우팅 가중치 (F008, 향후) |
| `created_at` | timestamp | NOT NULL, auto-set | 레코드 생성 타임스탬프 |
| `updated_at` | timestamp | NOT NULL, auto-set | 마지막 업데이트 타임스탬프 |

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

LLM 모델 구성 엔티티. 클라이언트가 사용하는 모델명을 프로바이더별 모델에 매핑하고, 가격 및 기능 메타데이터를 포함한다.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `provider_id` | UUID | FK -> `providers.id`, NOT NULL | 소유 프로바이더 |
| `name` | varchar | NOT NULL, UNIQUE | 클라이언트가 사용하는 모델명 (예: `"gpt-4o"`, `"claude-sonnet-4-20250514"`) |
| `display_name` | varchar | NOT NULL | 사람이 읽을 수 있는 표시 이름 |
| `input_price_per_token` | decimal(20,12) | NOT NULL, default: `0` | 입력 토큰당 비용 (USD) |
| `output_price_per_token` | decimal(20,12) | NOT NULL, default: `0` | 출력 토큰당 비용 (USD) |
| `max_tokens` | integer | NOT NULL, default: `4096` | 지원되는 최대 출력 토큰 수 |
| `context_window` | integer | NOT NULL, default: `128000` | 최대 컨텍스트 윈도우 크기 (입력 + 출력) |
| `enabled` | boolean | NOT NULL, default: `true` | 이 모델이 요청에 사용 가능한지 여부 |
| `created_at` | timestamp | NOT NULL, auto-set | 레코드 생성 타임스탬프 |
| `updated_at` | timestamp | NOT NULL, auto-set | 마지막 업데이트 타임스탬프 |

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

### GatewayRequest (런타임 컨텍스트 — 비영속)

요청 처리 중 사용되는 인메모리 요청 컨텍스트. 데이터베이스 엔티티가 아니다. 토큰 카운팅, 에러 처리, 향후 로깅(F005)을 위한 단일 게이트웨이 요청의 라이프사이클을 추적한다.

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string (UUID) | 고유 요청 식별자 |
| `model` | string | 요청된 모델명 |
| `provider` | ProviderType | 해석된 프로바이더 타입 |
| `stream` | boolean | 스트리밍이 요청되었는지 여부 |
| `promptTokens` | number | 입력 토큰 수 (프로바이더 usage 기준) |
| `completionTokens` | number | 출력 토큰 수 (프로바이더 usage 기준) |
| `totalTokens` | number | 총 토큰 수 (prompt + completion) |
| `startedAt` | Date | 요청 시작 타임스탬프 |
| `completedAt` | Date \| null | 요청 완료 타임스탬프 |
| `error` | string \| null | 요청 실패 시 에러 메시지 |
| `tokensStreamed` | number | 에러 전까지 성공적으로 스트리밍된 토큰 수 (스트림 중간 실패 시) |

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
| Provider | `UQ_providers_name` | `(name)` | UNIQUE | 중복 프로바이더 이름 방지 |
| Provider | `IDX_providers_type` | `(type)` | INDEX | 프로바이더 타입별 빠른 조회 |
| Provider | `IDX_providers_enabled` | `(enabled)` | INDEX | 활성 프로바이더 필터링 |
| Model | `UQ_models_name` | `(name)` | UNIQUE | 중복 모델 이름 방지 |
| Model | `IDX_models_provider_id` | `(provider_id)` | INDEX | 프로바이더 관계의 FK 인덱스 |
| Model | `IDX_models_enabled` | `(enabled)` | INDEX | 활성 모델 필터링 |

## Relationships

```
Provider (1) ----< (N) Model
  - 하나의 프로바이더는 여러 모델을 가진다
  - 각 모델은 정확히 하나의 프로바이더에 속한다
  - FK: models.provider_id -> providers.id
  - Cascade: 없음 (프로바이더 삭제 시 먼저 모델을 제거해야 함)
```

## Seed Data

개발 및 테스트를 위한 초기 시드 데이터:

```typescript
// Provider 시드
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

// Model 시드
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

- **초기 마이그레이션**: 모든 컬럼, 인덱스, FK 제약조건을 포함한 `providers` 및 `models` 테이블을 생성한다.
- **시드 마이그레이션**: 기본 프로바이더 및 모델 레코드를 삽입한다.
- **마이그레이션 명령**: `npm run migration:generate -- -n CreateProvidersAndModels`
- **실행 명령**: `npm run migration:run`
- **Auto-sync**: `development` 환경에서만 활성화. `staging` 및 `production`에서는 비활성화.

## Notes

- `api_key_encrypted` 컬럼은 암호화된 API 키를 저장한다. 개발 환경에서는 env 변수(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)가 ConfigService를 통해 직접 사용된다. 이 컬럼은 멀티테넌트 키 관리(F003)를 위해 예약되어 있다.
- Provider의 `weight` 컬럼은 향후 로드 밸런싱(F008)을 위해 예약되어 있다. 기본값 1은 동일 가중치를 의미한다.
- `GatewayRequestContext`는 의도적으로 영속화되지 않는다. 요청 로깅(F005)에서 이 컨텍스트의 일부를 캡처하는 영속 `GatewayLog` 엔티티가 도입될 것이다.
- Model의 `context_window`은 정보 제공용이다. 실제 컨텍스트 제한 집행은 F004 (Token Budget)로 연기된다.
