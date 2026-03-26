# Data Model: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25
**Phase**: 1 (설계)

## Entities

### AppConfig

범용 애플리케이션 설정 엔티티. 환경별 키-값 쌍을 저장하여 재배포 없이 런타임 구성을 가능하게 한다.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `key` | varchar | NOT NULL, indexed | 설정 키 이름 |
| `value` | text | NOT NULL | 설정 값 (텍스트로 저장, 소비자가 파싱) |
| `environment` | varchar | NOT NULL, default: `'default'` | 대상 환경 (예: `default`, `development`, `production`) |
| `created_at` | timestamp | NOT NULL, auto-set | 레코드 생성 타임스탬프 |
| `updated_at` | timestamp | NOT NULL, auto-set | 마지막 업데이트 타임스탬프 |

**TypeORM Entity**:

```typescript
@Entity('app_config')
export class AppConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: false })
  key: string;

  @Column('text')
  value: string;

  @Column({ default: 'default' })
  environment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Indexes

| Entity | Index Name | Columns | Type | Purpose |
|--------|-----------|---------|------|---------|
| AppConfig | `UQ_app_config_key_env` | `(key, environment)` | UNIQUE | 환경별 중복 설정 키 방지 |
| AppConfig | `IDX_app_config_key` | `(key)` | INDEX | 키별 빠른 조회 |

## Relationships

- 관계 없음. AppConfig는 F001이 소유하는 독립 엔티티이다.
- 향후 Feature에서 기능 플래그나 설정 조회를 위해 AppConfig를 참조할 수 있지만, 이 엔티티로부터/로의 외래 키는 없다.

## Migration Strategy

- **초기 마이그레이션**: 모든 컬럼과 인덱스를 포함한 `app_config` 테이블 생성.
- **마이그레이션 명령**: `npm run migration:generate -- -n CreateAppConfig`
- **실행 명령**: `npm run migration:run`
- **Auto-sync**: TypeORM 설정의 `synchronize: true`를 통해 `development` 환경에서만 활성화. `staging`과 `production`에서는 비활성화.

## Notes

- `value` 컬럼은 JSON 문자열, 긴 URL, 또는 여러 줄 구성을 수용하기 위해 `text` 타입이다.
- `environment` 컬럼은 `default` 폴백을 유지하면서 환경별 오버라이드 저장을 가능하게 한다.
- 이 엔티티는 의도적으로 단순하다. 복잡한 설정(예: provider credentials)은 각 Feature(F002, F003)의 전용 엔티티에서 처리된다.
