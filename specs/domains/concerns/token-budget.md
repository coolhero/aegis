# Concern: token-budget

> Hierarchical token and cost budget management for multi-tenant LLM platforms.
> Distinct from resilience (flat rate-limit). Token-budget is LLM-specific with hierarchical (Org>Team>User) budgets tracking both tokens and monetary cost.

---

## Signal Keywords

### Semantic (S0 — for init inference)

**Primary**: token budget, token limit, usage quota, cost limit, spending cap, hierarchical budget, token metering, usage tracking, cost attribution, budget enforcement

**Secondary**: token reservation, budget alert, soft limit, hard limit, budget reset, carryover, overage policy, per-user quota, per-team budget, cost dashboard, token estimation, budget hierarchy

### Code Patterns (R1 — for source analysis)

- **Budget check**: `BudgetGuard`, `checkBudget()`, `canAfford()`, `reserveTokens()`, pre-request budget validation
- **Token counting**: `TokenCounter`, `tiktoken`, `countTokens()`, streaming token accumulation, input/output separate counting
- **Hierarchy**: `OrgBudget`, `TeamBudget`, `UserBudget`, `BudgetHierarchy`, parent-child budget relationship
- **Deduction**: `deductTokens()`, `reconcileBudget()`, atomic decrement, Redis `DECRBY` / Lua scripts
- **Reset**: `BudgetReset`, cron-based reset, monthly/weekly/daily cycle, carryover calculation
- **Alerts**: `BudgetAlert`, threshold notification (80%, 90%, 100%), webhook/email alerts

---

## S1. SC Generation Rules

### Required SC Patterns

When this concern is active, every Feature involving LLM calls MUST include SCs for:

| Pattern | SC Requirement |
|---------|---------------|
| **Budget Check Flow** | Specify: pre-request estimation → budget check → reserve → execute → reconcile. Must define behavior for each stage failure. |
| **Deduction Atomicity** | Budget check and deduction must be atomic (no race condition between check and deduct). Specify: concurrency control mechanism (Redis Lua, DB transaction, optimistic lock). |
| **Hierarchy Enforcement** | Budget deduction cascades through hierarchy: User deducted → Team deducted → Org deducted. If any level exceeds limit, request is rejected. Specify: which level is checked first, and override policies. |
| **Reset Cycle** | Specify: reset period (daily/weekly/monthly), reset time (UTC or tenant timezone), carryover policy (reset to max, accumulate, or decay). |
| **Alert Thresholds** | Specify: at what % of budget are alerts triggered (e.g., 80%, 90%, 100%). Alert delivery method (webhook, email, in-app). Behavior at 100%: hard block or soft warning. |

### SC Anti-Patterns (reject if seen)

- "Token usage is tracked" — must specify granularity (per-request, per-user, per-team), metrics (input tokens, output tokens, cost), and storage
- "Budget is checked before request" — must specify estimation method, atomicity guarantee, and over-budget behavior
- "Users have token limits" — must specify hierarchy, hard vs soft limits, reset cycle, and alert mechanism
- "Cost is calculated" — must specify pricing source (provider API, local table), currency, and attribution level

---

## S5. Elaboration Probes

| Sub-domain | Probe Questions |
|------------|----------------|
| **Granularity** | What budget levels? Org only? Org>Team? Org>Team>User? Per-project? |
| **Metric** | Tokens only? Tokens + monetary cost? Input/output counted separately? |
| **Reset** | Monthly reset? Weekly? Custom cycle? Carryover unused budget? |
| **Hard vs Soft limit** | Hard block at limit? Soft warning with overage? Different per level? |
| **Carryover** | Unused budget rolls over? Decays? Resets to zero? |
| **Emergency** | Admin override to bypass budget? Emergency budget increase flow? |

---

## S7. Bug Prevention

| ID | Pattern | Detection | Prevention |
|----|---------|-----------|------------|
| TB-001 | **Race Condition on Budget Check** | Two concurrent requests both pass budget check → both execute → combined cost exceeds budget | Atomic check-and-reserve using Redis Lua script or PostgreSQL SELECT FOR UPDATE. Reserve estimated tokens before execution, reconcile after. |
| TB-002 | **Retry Double-Charge** | Request fails mid-stream → auto-retried → both attempts charged → user billed twice for one logical request | Idempotency key per logical request. Retry reuses same reservation. Only reconcile final successful attempt; release reservation on permanent failure. |
| TB-003 | **Streaming Token Count Drift** | Streaming response counted chunk-by-chunk → accumulated count drifts from provider's final count → budget discrepancy | Use provider's `usage` field in final SSE event as ground truth. Chunk counting is for real-time display only. Reconcile against provider's number. |
| TB-004 | **Reset Timing Race** | Budget reset runs while requests are in-flight → in-flight request's post-reconciliation deducts from new budget period → new period starts negative | Budget reset creates new period record. In-flight requests reconcile against their original period (tracked by period ID at reservation time). |
| TB-005 | **Hierarchy Bypass** | User budget has remaining tokens but Team budget is exhausted → request allowed if only user-level check runs → exceeds team budget | Budget check must traverse ALL hierarchy levels. Short-circuit on first limit hit. Check order: User → Team → Org (bottom-up, most restrictive first). |

---

## S3. Verification Approach

| Aspect | Verification Method |
|--------|-------------------|
| **Atomicity** | Load test with 100 concurrent requests hitting budget boundary → verify total deducted ≤ budget + one request margin |
| **Hierarchy** | Set Team budget to 1000 tokens, User A to 500, User B to 500 → verify Team blocks at 1000 even if individual users have remaining |
| **Reset** | Set budget reset to 1-minute cycle → verify budget restores, in-flight requests reconcile to correct period |
| **Streaming accuracy** | Compare chunk-by-chunk accumulation vs provider's final usage field → verify reconciliation corrects drift |

---

## S9. Brief Completion Criteria

| Required Element | Completion Signal |
|-----------------|-------------------|
| **Budget hierarchy** | Levels defined (e.g., Org>Team>User) with enforcement order |
| **Metric type** | What is tracked (tokens, cost, or both) and counting method |
| **Enforcement behavior** | Hard block vs soft warning at each level |
| **Reset cycle** | Period, timing, and carryover policy stated |

---

## Module Metadata

- **Axis**: Concern
- **Common pairings**: multi-tenancy, auth, observability, ai-gateway (archetype)
- **Distinguished from**:
  - `resilience`: Generic rate-limiting. Token-budget is LLM-specific with hierarchical budgets and token/cost dual tracking.
  - `observability`: Tracks metrics. Token-budget enforces limits and blocks requests.
