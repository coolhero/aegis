# Archetype: ai-gateway

> LLM API gateway infrastructure — multi-provider routing, streaming proxy, token budget enforcement, multi-tenant isolation, and audit logging.
> Distinct from ai-assistant (LLM consumer perspective) and network-server (generic L4/L7). This is the LLM management/governance layer.

---

## Signal Keywords

### Semantic (A0 — for init inference)

**Primary**: LLM gateway, AI gateway, LLM proxy, LLM router, multi-provider, model routing, token budget, usage metering, AI API management, LLM orchestration

**Secondary**: provider fallback, streaming proxy, token tracking, cost attribution, model switching, rate limiting per tenant, API key management, LLM load balancing, request logging, provider health check

### Code Patterns (A0 — for source analysis)

- **Provider abstraction**: `ProviderRegistry`, `ModelRouter`, `ProviderAdapter`, provider config with model mappings
- **Streaming proxy**: SSE forwarding, `ReadableStream` pipe, chunk-by-chunk token counting, `text/event-stream` proxy
- **Budget enforcement**: `BudgetGuard`, `TokenCounter`, pre-request budget check, post-request deduction
- **Multi-tenant**: `TenantContext`, tenant-scoped API keys, tenant middleware, `X-Tenant-ID` header
- **Audit**: `RequestLogger`, full request/response capture, cost calculation per request
- **Config**: Provider credentials per tenant, model allowlist, fallback chain definition

---

## A1. Philosophy Principles

| Principle | Description | Implication |
|-----------|-------------|-------------|
| **Provider Abstraction** | All LLM providers are accessed through a unified interface. Business logic never calls provider SDKs directly. | SCs must specify which providers are supported. Verify adding a new provider requires only configuration, not code changes. |
| **Streaming-First** | SSE/WebSocket streaming is the default delivery mode. The gateway proxies token-by-token from provider to client. | SCs must specify streaming behavior including partial response handling, mid-stream error recovery, and backpressure. |
| **Token-Aware Routing** | Routing decisions consider token budgets, not just availability. A request is rejected or rerouted if the tenant's budget is insufficient. | SCs involving LLM calls must specify budget check timing (pre-request), estimation method, and over-budget behavior. |
| **Multi-tenant Isolation** | Each tenant operates in complete isolation — separate budgets, API keys, model access policies, and audit trails. No data leakage between tenants. | SCs must specify tenant context propagation. Verify cross-tenant access is impossible even under error conditions. |
| **Audit Everything** | Every LLM interaction is logged with full context: tenant, user, model, input/output, tokens, cost, latency, guardrail decisions. | SCs must specify what is logged and retention policy. Verify logs are immutable and contain forensic-grade detail. |

---

## A2. SC Generation Extensions

### Required SC Patterns (append to S1)

- **Provider routing**: SC specifies which provider(s) are targeted, fallback chain, and selection criteria (latency, cost, capability)
- **Streaming lifecycle**: SC specifies stream initiation, chunk forwarding, error mid-stream, and stream termination behavior
- **Budget gate**: SC specifies pre-request token estimation, budget check result handling (reject, downgrade model, queue), and post-request reconciliation
- **Tenant scope**: SC specifies how tenant context is determined (API key, JWT, header) and how isolation is enforced
- **Audit capture**: SC specifies which fields are captured, how sensitive content (PII) is handled in logs, and log retention

### SC Anti-Patterns (reject)

- "Request is sent to the LLM" — must specify provider selection, fallback, streaming mode, and budget check
- "Response is returned to the user" — must specify streaming vs batch, token counting, cost attribution, and audit logging
- "Gateway routes the request" — must specify routing criteria, tenant context, and what happens on all-providers-down
- "Usage is tracked" — must specify granularity (per-request vs aggregated), what metrics, and attribution hierarchy

---

## A3. Elaboration Probes (append to S5)

| Sub-domain | Probe Questions |
|------------|----------------|
| **Provider strategy** | Which LLM providers? OpenAI, Anthropic, Google, self-hosted? Model-specific routing? |
| **Routing logic** | Latency-based? Cost-based? Capability-based? Manual assignment per tenant? |
| **Streaming architecture** | SSE proxy? WebSocket? How are streaming errors handled mid-response? |
| **Budget model** | Per-tenant? Per-user? Hierarchical (org>team>user)? Hard limit vs soft limit? |
| **Audit requirements** | Full request/response logging? PII redaction in logs? Retention period? Compliance needs? |
| **Failover strategy** | Automatic fallback to secondary provider? Circuit breaker? How is failover communicated to client? |

---

## A4. Constitution Injection

| Principle | Rationale |
|-----------|-----------|
| All provider interactions must go through the ProviderRouter — no direct SDK calls from business logic | Centralizes retry, error handling, and audit; enables provider switching without code changes |
| Token budget must be checked BEFORE sending request to provider — never charge after a failed request | Pre-check prevents budget drain on errors; post-reconciliation adjusts for actual vs estimated tokens |
| Streaming proxy must forward chunks without buffering the full response — true streaming, not collect-then-send | Buffering defeats the purpose of streaming; true proxy minimizes TTFT (time-to-first-token) |
| Tenant context must be established at the gateway edge and propagated through all layers — no re-lookup mid-request | Single source of tenant identity prevents inconsistency; middleware pattern ensures every layer sees the same tenant |
| Every LLM request must produce an immutable audit event before the response reaches the client | Audit events are the compliance backbone; immutability prevents tampering; pre-response ensures no lost events |

---

## A5. Brief Completion Criteria

| Required Element | Completion Signal |
|-----------------|-------------------|
| Provider strategy | At least one provider + multi-provider intent stated (single, multi, or abstracted) |
| Routing model | How requests are routed to providers (criteria, fallback chain) |
| Budget enforcement | How token budgets are enforced (pre-check, hard/soft limit, hierarchy) |
| Tenant model | How tenants are identified and isolated (API key, JWT, header) |
| Audit scope | What is logged per request (fields, retention, compliance) |

---

## S7. Failure Modes (Bug Prevention)

| ID | Failure Pattern | What Goes Wrong | Prevention Rule |
|----|----------------|-----------------|-----------------|
| AG-001 | **Provider Cascade Failure** | Primary provider fails → all requests flood secondary → secondary also fails → total outage | Circuit breaker per provider with independent health checks. Exponential backoff on failover. Max 2 failover hops per request. |
| AG-002 | **Streaming Token Count Mismatch** | Error occurs mid-stream → partial tokens delivered but full token count charged → budget discrepancy | Token counting must be chunk-by-chunk during stream. On mid-stream error, reconcile actual delivered tokens vs charged. |
| AG-003 | **Tenant Isolation Bypass** | Error handler returns cached response from wrong tenant → data leakage across tenants | Cache keys must include tenant ID. Error responses must never contain data from other tenants. Verify with cross-tenant test. |
| AG-004 | **Budget Race Condition** | Concurrent requests pass budget check simultaneously → both proceed → combined cost exceeds budget | Atomic budget check-and-deduct (Redis WATCH/MULTI or Lua script). Estimated tokens reserved before request, reconciled after. |
| AG-005 | **Fallback Infinite Loop** | Primary → secondary → primary → secondary... when both providers return retriable errors | Max retry depth per request (e.g., 3). Fallback chain is acyclic. After exhausting chain, return 503 with retry-after header. |

---

## Module Metadata

- **Axis**: Archetype
- **Typical interfaces**: http-api
- **Common pairings**: multi-tenancy, auth, observability, resilience, stream-processing, external-sdk
- **Distinguished from**:
  - `ai-assistant`: Consumer-side (uses LLM). ai-gateway is manager-side (routes/governs LLM access).
  - `network-server`: Generic L4/L7 proxy. ai-gateway is LLM-specific with token awareness.
  - `inference-server`: Serves ML models directly. ai-gateway routes to inference servers or cloud APIs.
