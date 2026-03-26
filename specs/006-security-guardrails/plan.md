# Implementation Plan: Security Guardrails

**Branch**: `006-security-guardrails` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-security-guardrails/spec.md`

## Summary

LLM 요청/응답 파이프라인에 보안 가드레일을 삽입하여 PII 탐지/마스킹, 프롬프트 인젝션 방어, 콘텐츠 필터링을 수행한다. NestJS Guard(인젝션) + Interceptor(PII/콘텐츠) 패턴으로 구현하며, 테넌트별 보안 정책을 지원한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, Redis (정책 캐싱)
**Storage**: PostgreSQL (SecurityPolicy, GuardResult)
**Testing**: Jest + Supertest
**Target Platform**: Node.js server (NestJS)
**Performance Goals**: 가드레일 파이프라인 전체 ≤ 100ms
**Constraints**: 인라인 파이프라인이므로 레이턴시 최소화 필수
**Scale/Scope**: 멀티테넌트, 조직별 정책

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Tenant Data Isolation | ✅ | SecurityPolicy는 org_id로 격리. GuardResult는 request_id 기반 |
| Streaming-First | ✅ | 출력 필터가 SSE 스트리밍 파이프라인에 동기식 삽입 |
| Audit Trail | ✅ | 모든 가드레일 판정 GuardResult에 기록 |
| Test-First | ✅ | 각 스캐너별 단위 테스트 + 통합 테스트 |
| Simplicity First | ✅ | Regex 기반 PII + 휴리스틱 인젝션 (ML은 MVP 이후) |
| Demo-Ready | ✅ | demos/F006-security-guardrails.sh 제공 |

## Project Structure

### Source Code

```text
apps/api/src/security/
├── security.module.ts              # SecurityModule 정의
├── security.guard.ts               # SecurityGuard (인젝션 탐지, NestJS Guard)
├── guard.interceptor.ts            # GuardInterceptor (PII 마스킹 + 출력 필터, NestJS Interceptor)
├── guard-pipeline.service.ts       # GuardPipeline 오케스트레이션 서비스
├── security-policy.service.ts      # SecurityPolicy CRUD + 캐싱
├── security-policy.controller.ts   # GET/PUT /security-policies/:orgId
├── scanners/
│   ├── scanner.interface.ts        # Scanner 공통 인터페이스
│   ├── pii.scanner.ts              # PII 탐지/마스킹 스캐너
│   ├── injection.scanner.ts        # 프롬프트 인젝션 탐지 스캐너
│   ├── content.scanner.ts          # 콘텐츠 필터 스캐너
│   └── normalizer.ts               # 입력 정규화 (Base64, Unicode, HTML)
├── entities/
│   ├── security-policy.entity.ts   # SecurityPolicy TypeORM 엔티티
│   └── guard-result.entity.ts      # GuardResult TypeORM 엔티티
├── dto/
│   ├── update-security-policy.dto.ts
│   └── security-policy-response.dto.ts
└── __tests__/
    ├── security.guard.spec.ts
    ├── guard.interceptor.spec.ts
    ├── pii.scanner.spec.ts
    ├── injection.scanner.spec.ts
    ├── content.scanner.spec.ts
    ├── normalizer.spec.ts
    ├── security-policy.service.spec.ts
    └── security-policy.controller.spec.ts
```

## Architecture

### Guard Pipeline Flow

```
Client Request
    │
    ▼
AuthGuard (F003)          ← 인증 확인
    │
    ▼
TenantContext (F003)      ← 테넌트 식별
    │
    ▼
BudgetGuard (F004)        ← 예산 확인
    │
    ▼
SecurityGuard (F006)      ← 인젝션 탐지 (reject → 403)
    │                        바이패스 체크 (X-Guard-Bypass)
    ▼
GuardInterceptor (F006)   ← [before] 입력 PII 마스킹 + 콘텐츠 필터
    │
    ▼
LLM Gateway (F002)        ← POST /v1/chat/completions
    │
    ▼
GuardInterceptor (F006)   ← [after] 출력 PII 마스킹 + 콘텐츠 필터
    │                        스트리밍: 청크별 버퍼 + 필터 → 전송
    ▼
RequestLogger (F005)      ← 마스킹된 입출력 로깅 (PG-001)
    │
    ▼
Client Response
```

### Scanner Interface

```typescript
interface Scanner {
  type: ScannerType; // 'pii' | 'injection' | 'content'
  scan(input: string, policy: SecurityPolicy): ScanResult;
}

interface ScanResult {
  decision: 'pass' | 'block' | 'mask';
  transformed?: string;  // 마스킹된 텍스트 (decision=mask)
  details: Record<string, any>;
  latency_ms: number;
}
```

### SecurityPolicy Caching

- Redis 키: `security-policy:{org_id}`
- TTL: 300초 (5분)
- 무효화: PUT /security-policies/:orgId 시 해당 키 삭제
- Cache miss → DB 조회 → 없으면 기본 정책 반환

### Streaming Output Filter

```
SSE Chunk 수신
    │
    ▼
Buffer에 추가 (최근 50자 유지)
    │
    ▼
PII Scanner (buffer 전체 대상)
    │
    ├── PII 감지 → 마스킹 후 전송 가능 부분만 flush
    │
    └── PII 미감지 → 안전 확인된 부분 flush, 잔여 buffer 유지
    │
    ▼
Client에 마스킹된 청크 전송
```

## Implementation Phases

### Phase 1: Core Scanners + Entities (FR-001~005, FR-014~018)
- SecurityPolicy, GuardResult TypeORM 엔티티
- Scanner 인터페이스 + PII Scanner + Injection Scanner + Normalizer
- GuardPipeline 서비스 (스캐너 오케스트레이션)
- 단위 테스트

### Phase 2: Guard + Interceptor Integration (FR-001, FR-009~011)
- SecurityGuard (NestJS Guard — 인젝션)
- GuardInterceptor (NestJS Interceptor — 입력 PII + 출력 필터)
- 스트리밍 출력 버퍼 필터
- F002 파이프라인에 Guard/Interceptor 연결

### Phase 3: Policy API + Bypass (FR-006~008, FR-012~013, FR-019)
- SecurityPolicyService (CRUD + Redis 캐싱)
- SecurityPolicyController (GET/PUT API)
- 바이패스 로직 (X-Guard-Bypass 헤더)
- Content Scanner

### Phase 4: Integration + Demo
- F005 RequestLogger와 mask-then-log 연동
- 통합 테스트 (전체 파이프라인)
- 데모 스크립트
