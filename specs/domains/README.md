# AEGIS Custom Domain Modules

Project-local domain modules for the spec-kit-skills pipeline.
These extend the built-in modules with AEGIS-specific patterns.

## Modules

### Archetypes
| Module | Description |
|--------|-------------|
| [ai-gateway](archetypes/ai-gateway.md) | LLM API gateway — multi-provider routing, streaming proxy, token budget enforcement |

### Concerns
| Module | Description |
|--------|-------------|
| [token-budget](concerns/token-budget.md) | Hierarchical token/cost budget management (Org>Team>User) |
| [prompt-guard](concerns/prompt-guard.md) | LLM security — prompt injection defense, PII masking, content filtering |

## Resolution

These modules are loaded AFTER built-in modules and extend/override via append semantics.
See `smart-sdd/domains/_resolver.md` Step 6b for resolution order.
