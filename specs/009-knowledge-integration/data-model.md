# Data Model: F009 — Knowledge Integration

## Document

```typescript
@Entity('document')
export class Document {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') orgId: string;
  @Column() title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ default: 'text/markdown' }) contentType: string;
  @Column({ default: 0 }) chunkCount: number;
  @Column({ default: 'pending' }) embeddingStatus: 'pending' | 'processing' | 'done' | 'failed';
  @Column({ type: 'text', nullable: true }) errorDetail: string | null;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
  @OneToMany(() => Embedding, e => e.document) embeddings: Embedding[];
}
```

## Embedding

```typescript
@Entity('embedding')
export class Embedding {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') documentId: string;
  @Column() chunkIndex: number;
  @Column({ type: 'text' }) content: string; // 원문 청크
  @Column({ type: 'vector', length: 1536 }) vector: number[]; // pgvector
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'document_id' }) document: Document;
}
```

**pgvector column 참고**: TypeORM에서 pgvector를 사용하려면 커스텀 컬럼 타입 등록 또는 `@Column({ type: 'float8', array: true })` + raw SQL 벡터 검색 사용.

## McpServer

```typescript
@Entity('mcp_server')
export class McpServer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') orgId: string;
  @Column() name: string;
  @Column() url: string;
  @Column({ default: '2024-11-05' }) protocolVersion: string;
  @Column({ type: 'jsonb', default: [] }) tools: McpTool[];
  @Column({ default: true }) enabled: boolean;
  @Column({ default: 'unknown' }) healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
```
