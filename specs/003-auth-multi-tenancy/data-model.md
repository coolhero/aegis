# Data Model: F003 — Auth & Multi-tenancy

**Feature**: F003 — Auth & Multi-tenancy
**Date**: 2025-03-25
**Phase**: 1 (Design)

## Entities

### Organization

최상위 테넌트 단위. 모든 멀티테넌트 데이터의 루트.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `name` | varchar(100) | NOT NULL | 조직 표시명 |
| `slug` | varchar(50) | NOT NULL, UNIQUE | URL-safe 식별자 |
| `plan` | varchar(20) | NOT NULL, default: `'free'` | 요금제 (free/pro/enterprise) |
| `settings` | jsonb | NULLABLE, default: `'{}'` | 조직별 설정 (JSON) |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `updated_at` | timestamp | NOT NULL, auto-set | 수정일 |

**TypeORM Entity**:

```typescript
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ length: 20, default: 'free' })
  plan: string;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  settings: Record<string, any>;

  @OneToMany(() => Team, (team) => team.organization)
  teams: Team[];

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => ApiKey, (apiKey) => apiKey.organization)
  apiKeys: ApiKey[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### Team

Organization 하위 그룹. 사용자를 팀 단위로 구분.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `org_id` | UUID | FK -> `organizations.id`, NOT NULL | 소속 조직 |
| `name` | varchar(100) | NOT NULL | 팀 표시명 |
| `slug` | varchar(50) | NOT NULL | URL-safe 식별자 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `updated_at` | timestamp | NOT NULL, auto-set | 수정일 |

**TypeORM Entity**:

```typescript
@Entity('teams')
@Unique(['orgId', 'slug'])
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, (org) => org.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  slug: string;

  @OneToMany(() => User, (user) => user.team)
  users: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### User

시스템 사용자. Organization과 Team에 소속되며, RBAC 역할을 가짐.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `org_id` | UUID | FK -> `organizations.id`, NOT NULL | 소속 조직 |
| `team_id` | UUID | FK -> `teams.id`, NULLABLE | 소속 팀 (선택) |
| `email` | varchar(255) | NOT NULL, UNIQUE | 이메일 (로그인 ID) |
| `name` | varchar(100) | NOT NULL | 사용자 표시명 |
| `password_hash` | varchar(255) | NOT NULL | bcrypt 해시 |
| `role` | enum | NOT NULL, default: `'member'` | 역할: `admin` / `member` / `viewer` |
| `refresh_token_hash` | varchar(255) | NULLABLE | Refresh Token SHA-256 해시 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `updated_at` | timestamp | NOT NULL, auto-set | 수정일 |

**TypeORM Entity**:

```typescript
export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, (org) => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'team_id', nullable: true })
  teamId: string;

  @ManyToOne(() => Team, (team) => team.users, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ name: 'refresh_token_hash', length: 255, nullable: true })
  refreshTokenHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }
}
```

---

### ApiKey

API 인증 키. Organization 소속, 사용자가 생성/관리.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `org_id` | UUID | FK -> `organizations.id`, NOT NULL | 소속 조직 |
| `user_id` | UUID | FK -> `users.id`, NOT NULL | 생성자 |
| `key_hash` | varchar(255) | NOT NULL, UNIQUE | SHA-256 해시 |
| `key_prefix` | varchar(12) | NOT NULL | 마스킹된 prefix (예: `aegis_abc...`) |
| `name` | varchar(100) | NOT NULL | Key 표시명 |
| `scopes` | jsonb | NOT NULL, default: `'[]'` | 허용 모델 목록 (JSON array) |
| `last_used_at` | timestamp | NULLABLE | 마지막 사용 시각 |
| `expires_at` | timestamp | NULLABLE | 만료일 (null=무기한) |
| `revoked` | boolean | NOT NULL, default: `false` | 폐기 여부 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |

**TypeORM Entity**:

```typescript
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, (org) => org.apiKeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'key_hash', length: 255, unique: true })
  keyHash: string;

  @Column({ name: 'key_prefix', length: 12 })
  keyPrefix: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'jsonb', default: '[]' })
  scopes: string[];

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## Indexes

| Entity | Index Name | Columns | Type | Purpose |
|--------|-----------|---------|------|---------|
| Organization | `UQ_organizations_slug` | `(slug)` | UNIQUE | Slug 중복 방지 |
| Team | `UQ_teams_org_slug` | `(org_id, slug)` | UNIQUE | 조직 내 팀 slug 중복 방지 |
| Team | `IDX_teams_org_id` | `(org_id)` | INDEX | 조직별 팀 조회 |
| User | `UQ_users_email` | `(email)` | UNIQUE | 이메일 중복 방지 |
| User | `IDX_users_org_id` | `(org_id)` | INDEX | 조직별 사용자 조회 |
| User | `IDX_users_team_id` | `(team_id)` | INDEX | 팀별 사용자 조회 |
| ApiKey | `UQ_api_keys_key_hash` | `(key_hash)` | UNIQUE | 해시 중복 방지 + 인증 조회 |
| ApiKey | `IDX_api_keys_org_id` | `(org_id)` | INDEX | 조직별 API Key 조회 |

## Relationships

```
Organization (1) ----< (N) Team
  - FK: teams.org_id -> organizations.id, CASCADE DELETE

Organization (1) ----< (N) User
  - FK: users.org_id -> organizations.id, CASCADE DELETE

Organization (1) ----< (N) ApiKey
  - FK: api_keys.org_id -> organizations.id, CASCADE DELETE

Team (1) ----< (N) User
  - FK: users.team_id -> teams.id, SET NULL (팀 삭제 시 사용자는 팀 미소속)

User (1) ----< (N) ApiKey
  - FK: api_keys.user_id -> users.id, CASCADE DELETE
```

## Seed Data

```typescript
const seedOrg = {
  name: 'Demo Organization',
  slug: 'demo-org',
  plan: 'pro',
};

const seedTeams = [
  { name: 'Backend Team', slug: 'backend' },
  { name: 'Frontend Team', slug: 'frontend' },
];

const seedUsers = [
  { email: 'admin@demo.com', name: 'Admin User', role: UserRole.ADMIN, team: 'backend' },
  { email: 'dev@demo.com', name: 'Developer', role: UserRole.MEMBER, team: 'backend' },
  { email: 'viewer@demo.com', name: 'Viewer', role: UserRole.VIEWER, team: 'frontend' },
];

// 모든 seed 사용자의 비밀번호: 'password123'
// API Key: aegis_demo_key_... (seed 시점에 생성, 콘솔에 출력)
```

## Migration Strategy

- **초기 migration**: `organizations`, `teams`, `users`, `api_keys` 테이블을 모든 컬럼, 인덱스, FK 제약조건과 함께 생성.
- **Seed migration**: 데모 organization, teams, users, API key 1개 삽입.
- **Migration 생성 명령**: `npm run migration:generate -- -n CreateAuthEntities`
- **실행 명령**: `npm run migration:run`
- **Auto-sync**: 개발 환경에서 활성화. 스테이징/프로덕션에서는 비활성화.

## Notes

- `key_prefix` 필드는 API Key 목록에서 마스킹된 표시용. 해시만으로는 어떤 key인지 식별 불가.
- `refresh_token_hash`를 User 테이블에 직접 둔 이유: MVP에서 사용자당 1개의 활성 Refresh Token만 허용. 멀티디바이스 지원이 필요하면 별도 테이블 분리.
- `scopes`는 JSON 배열로 모델명 목록 저장. 빈 배열 `[]`은 모든 모델 허용.
- Organization 삭제 시 CASCADE로 하위 Team, User, ApiKey 모두 삭제.
