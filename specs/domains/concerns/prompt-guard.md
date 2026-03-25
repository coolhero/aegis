# Concern: prompt-guard

> LLM-specific security: prompt injection defense, PII detection/masking, output filtering, and content safety.
> Distinct from content-moderation (UGC review queues). Prompt-guard operates inline on LLM request/response pipeline with sub-100ms latency requirements.

---

## Signal Keywords

### Semantic (S0 — for init inference)

**Primary**: prompt injection, PII masking, PII detection, LLM security, guardrails, content filter, output safety, input validation, prompt defense, AI safety

**Secondary**: jailbreak, system prompt leakage, sensitive data disclosure, encoding bypass, token smuggling, indirect injection, content policy, toxicity filter, OWASP LLM, LLM Guard, NeMo Guardrails

### Code Patterns (R1 — for source analysis)

- **Input scanning**: `InputScanner`, `PromptInjectionDetector`, `PiiScanner`, regex + ML classifier pipeline
- **Output filtering**: `OutputValidator`, `PiiMasker`, `ContentFilter`, post-LLM response scanning
- **Guard pipeline**: `GuardPipeline`, `SecurityMiddleware`, ordered scanner chain (injection → PII → content)
- **PII patterns**: email regex, SSN/phone patterns, named entity recognition, configurable PII types
- **Libraries**: `llm-guard`, `nemo-guardrails`, `lakera`, `presidio`, custom scanner interface
- **Config**: per-tenant security policy, PII categories allowlist, content filter severity levels

---

## S1. SC Generation Rules

### Required SC Patterns

When this concern is active, every Feature involving LLM input/output MUST include SCs for:

| Pattern | SC Requirement |
|---------|---------------|
| **PII Detection in Input** | Specify: which PII types are scanned (email, phone, SSN, name, address, custom), detection method (regex, NER, ML), and action on detection (mask, reject, warn). |
| **PII Detection in Output** | Specify: LLM output scanned for PII before delivery to client. Same categories as input. Action: mask with placeholder, strip, or flag for review. |
| **Prompt Injection Defense** | Specify: input analyzed for injection patterns (direct instruction override, indirect data injection, encoding tricks). Detection method (classifier, heuristic, LLM-as-judge). Action: reject, sanitize, or flag. |
| **Content Filtering** | Specify: output checked against content policy (hate speech, violence, self-harm, illegal content). Severity levels and per-tenant policy overrides. |
| **Privileged Bypass** | Specify: which roles (admin, system) can bypass guardrails and under what conditions. Bypass must be logged. No silent bypass. |

### SC Anti-Patterns (reject if seen)

- "Input is validated" — must specify which validators (PII, injection, content), detection method, and action per type
- "PII is masked" — must specify which PII types, masking format (e.g., `[EMAIL]`, `***`), reversibility, and log handling
- "Prompt injection is prevented" — must specify detection method, false positive handling, and bypass for legitimate edge cases
- "Content is safe" — must specify content categories, severity thresholds, and per-tenant policy differences

---

## S5. Elaboration Probes

| Sub-domain | Probe Questions |
|------------|----------------|
| **PII scope** | Which PII types? Email, phone, SSN, name, address? Custom types (employee ID, project code)? |
| **PII action** | Mask with placeholder? Reject entire request? Allow but flag? Different per PII type? |
| **Injection defense** | Heuristic rules? ML classifier? LLM-as-judge (second LLM checks first)? Layered approach? |
| **Content categories** | Which categories filtered? Hate speech, violence, sexual, self-harm, illegal? Custom categories? |
| **False positives** | How are false positive PII detections handled? Override mechanism? Feedback loop? |
| **Audit** | Guardrail decisions logged? Original (pre-mask) content stored separately for compliance? Retention? |

---

## S7. Bug Prevention

| ID | Pattern | Detection | Prevention |
|----|---------|-----------|------------|
| PG-001 | **Mask-then-Log Ordering** | PII detected → original logged → then masked → PII already in plain text in logs | Guard pipeline order: detect → mask → log masked version. Original content NEVER written to standard logs. If compliance requires original storage, use encrypted separate store with restricted access. |
| PG-002 | **System Prompt Injection** | User input contains "Ignore previous instructions" or similar → LLM follows injected instruction → system prompt bypassed | System prompt isolated from user input (separate API parameter, not concatenated). Input scanner specifically checks for instruction-override patterns. Defense-in-depth: LLM-as-judge validates output coherence. |
| PG-003 | **Partial PII in Streaming** | PII split across SSE chunks (e.g., "john" in chunk 1, "@email.com" in chunk 2) → per-chunk scanner misses it | Streaming PII scanner maintains buffer window across chunks. Only flush confirmed non-PII content. Buffer at least N characters at chunk boundaries. |
| PG-004 | **Encoding Bypass** | PII or injection encoded (Base64, Unicode homoglyphs, ROT13, HTML entities) → scanner misses → decoded by LLM | Input normalization step BEFORE scanning: decode Base64, normalize Unicode, strip HTML entities. Scanner operates on normalized text. |
| PG-005 | **Output Filter Race Condition** | Streaming output sent to client in parallel with filter processing → some unfiltered chunks reach client before filter catches violation | Output filter must be synchronous in the streaming pipeline (filter chunk → send chunk). Never send-then-filter. If async filter used, buffer with watermark before sending. |

---

## S3. Verification Approach

| Aspect | Verification Method |
|--------|-------------------|
| **PII detection** | Test suite with known PII samples (50+ patterns) → verify detection rate ≥ 95% per category |
| **PII masking** | Verify masked output contains no original PII. Check logs contain only masked versions. |
| **Injection defense** | Red team test suite (OWASP prompt injection samples, encoding tricks) → verify block rate ≥ 90% |
| **Streaming safety** | Send PII split across SSE boundaries → verify scanner catches cross-chunk PII |
| **Encoding bypass** | Send Base64/Unicode/HTML-encoded PII → verify normalization + detection |
| **False positive rate** | Run 1000 legitimate prompts → verify false positive rate < 5% |

---

## S9. Brief Completion Criteria

| Required Element | Completion Signal |
|-----------------|-------------------|
| **PII scope** | Which PII types are scanned, with detection method stated |
| **Guard actions** | What happens on detection: mask, reject, or flag — per type |
| **Injection defense** | Detection method chosen (heuristic, ML, LLM-as-judge, or layered) |
| **Content categories** | Which content categories are filtered, with severity levels |

---

## Module Metadata

- **Axis**: Concern
- **Common pairings**: auth, audit-logging, compliance, ai-gateway (archetype), content-moderation
- **Distinguished from**:
  - `content-moderation`: UGC review with queues and appeals. Prompt-guard is inline, real-time LLM pipeline security.
  - `auth`: Identity verification. Prompt-guard is content-level security (what's in the prompt, not who sent it).
  - `compliance`: Regulatory framework. Prompt-guard implements the technical controls that compliance requires.
