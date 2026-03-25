# Plan: F002 — LLM Gateway Core

## Architecture Overview

Provider Adapter 패턴으로 LLM 프로바이더를 추상화. OpenAI-호환 형식을 유니버셜 포맷으로 사용하며, Anthropic 어댑터가 양방향 변환을 수행. SSE 스트리밍은 async generator로 구현.

## Data Model

### Provider Entity (owner: F002)
```typescript
@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: ProviderType })
  type: ProviderType;  // 'openai' | 'anthropic'

  @Column({ nullable: true })
  apiKeyEncrypted: string;

  @Column({ nullable: true })
  baseUrl: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 'unknown' })
  healthStatus: string;

  @Column({ type: 'int', default: 1 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Model Entity (owner: F002)
```typescript
@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerId: string;

  @ManyToOne(() => Provider)
  @JoinColumn({ name: 'providerId' })
  provider: Provider;

  @Column({ unique: true })
  name: string;

  @Column()
  displayName: string;

  @Column({ type: 'decimal', precision: 20, scale: 12, default: 0 })
  inputPricePerToken: number;

  @Column({ type: 'decimal', precision: 20, scale: 12, default: 0 })
  outputPricePerToken: number;

  @Column({ type: 'int', default: 4096 })
  maxTokens: number;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Project Structure

```
libs/common/src/gateway/
├── provider.interface.ts    # ProviderAdapter interface
├── gateway.types.ts         # OpenAI-compatible types
├── provider.entity.ts       # Provider TypeORM entity
└── model.entity.ts          # Model TypeORM entity

apps/api/src/gateway/
├── gateway.module.ts        # GatewayModule
├── gateway.controller.ts    # POST /v1/chat/completions
├── gateway.service.ts       # Core routing + streaming logic
├── gateway.controller.spec.ts # Tests
└── providers/
    ├── openai.adapter.ts    # OpenAI ProviderAdapter
    ├── anthropic.adapter.ts # Anthropic ProviderAdapter
    └── provider.registry.ts # Adapter registry + model routing
```

## Implementation Phases

### Phase 1: Shared Types & Entities
- ProviderAdapter 인터페이스 정의
- OpenAI-호환 요청/응답 타입 정의
- Provider, Model TypeORM 엔티티

### Phase 2: Provider Adapters
- OpenAI 어댑터 (openai SDK)
- Anthropic 어댑터 (@anthropic-ai/sdk, 형식 변환 포함)
- ProviderRegistry (모델명 → 어댑터 라우팅)

### Phase 3: Gateway Core
- GatewayService (라우팅, 스트리밍, 토큰 카운팅)
- GatewayController (SSE 엔드포인트, 에러 핸들링)
- GatewayModule 통합

### Phase 4: Tests & Integration
- Unit tests (모킹 기반)
- app.module.ts 통합
- package.json 의존성 추가

## Dependencies
- `openai` — OpenAI Node SDK
- `@anthropic-ai/sdk` — Anthropic Node SDK
- F001 Foundation (ConfigModule, DatabaseModule, RedisModule)
