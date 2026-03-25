# Data Model: F001 — Foundation Setup

**Feature**: F001 — Foundation Setup
**Date**: 2025-03-25
**Phase**: 1 (Design)

## Entities

### AppConfig

General-purpose application configuration entity. Stores key-value pairs per environment, enabling runtime configuration without redeployment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `key` | varchar | NOT NULL, indexed | Configuration key name |
| `value` | text | NOT NULL | Configuration value (stored as text, parsed by consumer) |
| `environment` | varchar | NOT NULL, default: `'default'` | Target environment (e.g., `default`, `development`, `production`) |
| `created_at` | timestamp | NOT NULL, auto-set | Record creation timestamp |
| `updated_at` | timestamp | NOT NULL, auto-set | Last update timestamp |

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
| AppConfig | `UQ_app_config_key_env` | `(key, environment)` | UNIQUE | Prevent duplicate config keys per environment |
| AppConfig | `IDX_app_config_key` | `(key)` | INDEX | Fast lookup by key |

## Relationships

- No relationships. AppConfig is a standalone entity owned by F001.
- Future features may reference AppConfig for feature-flag or configuration lookups, but no foreign keys point to/from this entity.

## Migration Strategy

- **Initial migration**: Creates `app_config` table with all columns and indexes.
- **Migration command**: `npm run migration:generate -- -n CreateAppConfig`
- **Run command**: `npm run migration:run`
- **Auto-sync**: Enabled only in `development` environment via `synchronize: true` in TypeORM config. Disabled in `staging` and `production`.

## Notes

- The `value` column is `text` type to accommodate JSON strings, long URLs, or multi-line configurations.
- The `environment` column enables storing environment-specific overrides while keeping a `default` fallback.
- This entity is intentionally simple. Complex configuration (e.g., provider credentials) will be handled by dedicated entities in their respective features (F002, F003).
