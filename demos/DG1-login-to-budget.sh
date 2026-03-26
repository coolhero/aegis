#!/usr/bin/env bash
set -euo pipefail

# DG1 — Integration Demo: Login → LLM Call → Budget Block
# Features: F002 (LLM Gateway) + F003 (Auth) + F004 (Token Budget)
# Usage: ./demos/DG1-login-to-budget.sh [--ci]

CI_MODE=false
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=true
fi

API_URL="http://localhost:3000"

# Load .env if shell env vars are missing (keys live in .env, not exported)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -z "${OPENAI_API_KEY:-}" && -z "${ANTHROPIC_API_KEY:-}" && -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

PASS=0
FAIL=0
SKIP=0

log_pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
log_skip() { echo "  ⏭️  $1"; SKIP=$((SKIP + 1)); }

echo "═══════════════════════════════════════════════════"
echo "  DG1 — Login → LLM Call → Budget Block"
echo "  Integration: F002 + F003 + F004"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Server startup ────────────────────────────────────
if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
  echo "Starting AEGIS server..."
  cd "$(dirname "$0")/.."
  npm run start:dev &
  SERVER_PID=$!

  echo "Waiting for server (up to 30s)..."
  for i in $(seq 1 30); do
    if curl -sf "$API_URL/health" > /dev/null 2>&1; then
      echo "Server ready!"
      break
    fi
    sleep 1
  done

  if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
    echo "ERROR: Server failed to start within 30s"
    exit 1
  fi
else
  echo "Server already running at $API_URL"
  SERVER_PID=""
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    echo ""
    echo "Stopping server (PID: $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Flush stale budget/reservation counters from Redis ─
# Previous test runs leave tier-specific + global usage counters that
# cause false 429s. Selective --scan deletion is unreliable (scan cursor
# race), so we use Lua SCAN+DEL inside Redis for atomicity.
echo "Flushing stale Redis budget keys..."
docker exec aegis-redis redis-cli EVAL "
  local cursor = '0'
  repeat
    local result = redis.call('SCAN', cursor, 'MATCH', 'budget:*', 'COUNT', 100)
    cursor = result[1]
    for _, key in ipairs(result[2]) do redis.call('DEL', key) end
  until cursor == '0'
  cursor = '0'
  repeat
    local result = redis.call('SCAN', cursor, 'MATCH', 'reservation:*', 'COUNT', 100)
    cursor = result[1]
    for _, key in ipairs(result[2]) do redis.call('DEL', key) end
  until cursor == '0'
  return 'OK'
" 0 > /dev/null
echo "Redis budget state cleared."

# ── CI Mode ───────────────────────────────────────────
if [[ "$CI_MODE" == "true" ]]; then
  echo ""
  echo "── Step 1: JWT Login (F003) ──"
  LOGIN_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@demo.com","password":"password123"}')

  TOKEN=$(echo "$LOGIN_RESP" | jq -r '.data.accessToken // empty')
  ORG_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.orgId // empty')
  USER_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.id // empty')

  if [[ -n "$TOKEN" ]]; then
    log_pass "JWT login succeeded (admin@demo.com)"
  else
    log_fail "JWT login failed"
    echo ""; echo "Result: $PASS passed, $FAIL failed, $SKIP skipped"
    exit 1
  fi

  echo ""
  echo "── Step 2: Create API Key (F003) ──"
  KEY_RESP=$(curl -sf -X POST "$API_URL/api-keys" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"dg1-ci-key","scopes":[]}')

  API_KEY=$(echo "$KEY_RESP" | jq -r '.data.key // .key // empty')
  if [[ -n "$API_KEY" ]]; then
    log_pass "API key created"
  else
    log_fail "API key creation failed"
    echo ""; echo "Result: $PASS passed, $FAIL failed, $SKIP skipped"
    exit 1
  fi

  echo ""
  echo "── Step 3: Set Generous Budget (F004) ──"
  BUDGET_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X PUT \
    "$API_URL/budgets/org/$ORG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":10000000,"cost_limit_usd":1000}')

  if [[ "$BUDGET_CODE" == "200" ]]; then
    log_pass "Org budget set (10M tokens / \$1000)"
  else
    log_fail "Org budget API returned $BUDGET_CODE"
  fi

  BUDGET_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X PUT \
    "$API_URL/budgets/user/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":10000000,"cost_limit_usd":1000}')

  if [[ "$BUDGET_CODE" == "200" ]]; then
    log_pass "User budget set (10M tokens / \$1000)"
  else
    log_fail "User budget API returned $BUDGET_CODE"
  fi

  # Also set tier-specific budget if gpt-4o has a model tier
  # (Previous F004 tests may have left a tier budget with a low limit)
  MODEL_TIER_ID=$(docker exec aegis-redis redis-cli GET "model_tier:gpt-4o" 2>/dev/null || true)
  if [[ -n "$MODEL_TIER_ID" && "$MODEL_TIER_ID" != "(nil)" ]]; then
    curl -sf -o /dev/null -X PUT \
      "$API_URL/budgets/user/$USER_ID?model_tier_id=$MODEL_TIER_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"token_limit":10000000,"cost_limit_usd":1000}'
    log_pass "User tier budget also set (10M tokens)"
  fi

  echo ""
  echo "── Step 4: LLM Request → Success (F002+F003+F004) ──"
  HAS_LLM_KEY=false
  if [[ -n "${OPENAI_API_KEY:-}" ]] || [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    HAS_LLM_KEY=true
  fi

  if [[ "$HAS_LLM_KEY" == "true" ]]; then
    LLM_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "$API_URL/v1/chat/completions" \
      -H "x-api-key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Say OK"}],"stream":false}')

    if [[ "$LLM_CODE" == "200" ]]; then
      log_pass "LLM request succeeded with budget (200)"
    else
      log_fail "LLM request returned $LLM_CODE (expected 200)"
    fi

    # Wait for async reconciliation to flush usage counters into Redis
    echo "  ⏳ Waiting 3s for budget reconciliation..."
    sleep 3

    echo ""
    echo "── Step 5: Lower Budget Below Usage → Block (F004) ──"
    # After the LLM call, Redis has accumulated usage (typically 20~100 tokens).
    # Set limit to 1 token — since usage already > 1, next call triggers 429.
    # NOTE: limit=0 is treated as "unlimited" by the Lua guard (skip check).
    # Must lower BOTH global and tier-specific budgets.
    curl -sf -o /dev/null -X PUT \
      "$API_URL/budgets/user/$USER_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"token_limit":1,"cost_limit_usd":0.0001}'

    if [[ -n "$MODEL_TIER_ID" && "$MODEL_TIER_ID" != "(nil)" ]]; then
      curl -sf -o /dev/null -X PUT \
        "$API_URL/budgets/user/$USER_ID?model_tier_id=$MODEL_TIER_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"token_limit":1,"cost_limit_usd":0.0001}'
    fi
    log_pass "User budget lowered to 1 token (global + tier)"

    echo ""
    echo "── Step 6: LLM Request → 429 Budget Block (F002+F004) ──"
    LLM_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "$API_URL/v1/chat/completions" \
      -H "x-api-key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}')

    if [[ "$LLM_CODE" == "429" ]]; then
      log_pass "LLM request blocked with 429 (budget exceeded)"
    else
      log_fail "LLM returned $LLM_CODE (expected 429 after budget lowered below usage)"
    fi
  else
    log_skip "No LLM API key — skipping LLM call + budget block test"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  DG1 Result: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════"

  if [[ "$FAIL" -gt 0 ]]; then
    exit 1
  fi
  exit 0
fi

# ── Interactive Mode ──────────────────────────────────
echo ""
echo "Logging in as admin@demo.com..."
LOGIN_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}')

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.data.accessToken')
ORG_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.orgId')
USER_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.id')

echo "🔑 Logged in — Org: $ORG_ID, User: $USER_ID"

# Auto-create API Key so user doesn't have to copy-paste
echo "🔑 Creating API Key..."
KEY_RESP=$(curl -sf -X POST "$API_URL/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"dg1-demo-key","scopes":[]}')
API_KEY=$(echo "$KEY_RESP" | jq -r '.data.key // .key')
echo "🔑 API Key: $API_KEY"
echo ""

# Set generous budget + tier budget for clean start
curl -sf -o /dev/null -X PUT "$API_URL/budgets/org/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_limit":10000000,"cost_limit_usd":1000}'
curl -sf -o /dev/null -X PUT "$API_URL/budgets/user/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_limit":10000000,"cost_limit_usd":1000}'
MODEL_TIER_ID=$(docker exec aegis-redis redis-cli GET "model_tier:gpt-4o" 2>/dev/null || true)
if [[ -n "$MODEL_TIER_ID" && "$MODEL_TIER_ID" != "(nil)" ]]; then
  curl -sf -o /dev/null -X PUT \
    "$API_URL/budgets/user/$USER_ID?model_tier_id=$MODEL_TIER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":10000000,"cost_limit_usd":1000}'
fi
echo "✅ 예산 초기화 완료 (10M 토큰)"
echo ""

echo "═══════════════════════════════════════════════════"
echo "  🎯 DG1 — 로그인 → LLM 호출 → 예산 차단"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  이 시나리오는 F002(LLM Gateway) + F003(Auth) + F004(Token Budget)의"
echo "  통합 동작을 검증합니다."
echo ""
echo "  흐름: 로그인 → 예산 설정 → API Key로 LLM 호출 → 예산 차감 확인"
echo "        → 예산 축소 → LLM 호출 차단(429) 확인"
echo ""
echo "  아래 명령을 순서대로 복사해서 다른 터미널에서 실행하세요."
echo "  (로그인, API Key, 예산 설정은 위에서 자동 완료됨)"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 1: LLM 호출 (F002+F003 통합)"
echo "  — F003의 API Key 인증 → F002의 LLM Gateway로 요청 전달."
echo "    F004의 예산 가드가 토큰을 차감합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  curl -s -X POST $API_URL/v1/chat/completions \\"
echo "    -H \"x-api-key: $API_KEY\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}' | jq"
echo ""
echo "  ✔ 확인: .choices[0].message.content에 LLM 응답, .usage에 토큰 사용량"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 2: 예산 차감 확인 (F004 검증)"
echo "  — Step 1의 LLM 호출로 토큰이 차감됐는지 확인합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  curl -s $API_URL/budgets/user/$USER_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" | jq '.data.current_period'"
echo ""
echo "  ✔ 확인: .total_tokens_used > 0 이면 예산 차감 성공"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 3: 예산 축소 → 429 차단 (F004 차단 동작)"
echo "  — 예산을 1 토큰으로 낮춰서, 이미 사용량이 초과된 상태를 만듭니다."
echo "    다음 LLM 요청은 429 budget_exceeded로 차단되어야 합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  # 3-a) 예산을 1 토큰으로 축소"
echo "  curl -s -X PUT $API_URL/budgets/user/$USER_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":1,\"cost_limit_usd\":0.0001}' | jq '.data.token_limit'"
echo ""
echo "  ✔ 확인: 1 출력"
echo ""
echo "  # 3-b) LLM 호출 → 차단 확인"
echo "  curl -s -X POST $API_URL/v1/chat/completions \\"
echo "    -H \"x-api-key: $API_KEY\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}]}' | jq"
echo ""
echo "  ✔ 확인: .statusCode = 429, .error = \"budget_exceeded\""
echo "    → F004의 예산 가드가 F002 LLM 호출을 차단한 것을 확인"
echo ""

echo "═══════════════════════════════════════════════════"
echo "  📌 Seed accounts: admin@demo.com / password123"
echo "  Server running — Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════"

# Block until Ctrl+C — 'wait' only waits for child processes,
# so if the server was already running (no child), we need a fallback.
if [[ -n "${SERVER_PID:-}" ]]; then
  wait "$SERVER_PID"
else
  trap 'echo ""; echo "Bye."; exit 0' INT
  while true; do sleep 86400; done
fi
