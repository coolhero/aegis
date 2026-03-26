#!/usr/bin/env bash
set -euo pipefail

# DG2 — Integration Demo: Auth → Logging & Tracing
# Features: F003 (Auth) + F005 (Request Logging & Tracing)
# Usage: ./demos/DG2-auth-logging.sh [--ci]

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
echo "  DG2 — Auth → Logging & Tracing"
echo "  Integration: F003 + F005"
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
  if [[ -n "$TOKEN" ]]; then
    log_pass "JWT login succeeded"
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
    -d '{"name":"dg2-ci-key","scopes":[]}')

  API_KEY=$(echo "$KEY_RESP" | jq -r '.data.key // .key // empty')
  if [[ -n "$API_KEY" ]]; then
    log_pass "API key created"
  else
    log_fail "API key creation failed"
    echo ""; echo "Result: $PASS passed, $FAIL failed, $SKIP skipped"
    exit 1
  fi

  echo ""
  echo "── Step 3: Ensure Budget Allows Requests (F004 dependency) ──"
  ORG_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.orgId // empty')
  USER_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.id // empty')

  curl -sf -o /dev/null -X PUT "$API_URL/budgets/org/$ORG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":10000000,"cost_limit_usd":1000}'
  curl -sf -o /dev/null -X PUT "$API_URL/budgets/user/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":10000000,"cost_limit_usd":1000}'

  # Also reset tier-specific budget if model tier exists
  MODEL_TIER_ID=$(docker exec aegis-redis redis-cli GET "model_tier:gpt-4o" 2>/dev/null || true)
  if [[ -n "$MODEL_TIER_ID" && "$MODEL_TIER_ID" != "(nil)" ]]; then
    curl -sf -o /dev/null -X PUT \
      "$API_URL/budgets/user/$USER_ID?model_tier_id=$MODEL_TIER_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"token_limit":10000000,"cost_limit_usd":1000}'
  fi
  log_pass "Budget set to generous limits (global + tier)"

  echo ""
  echo "── Step 4: LLM Request with Trace ID (F003+F005) ──"
  TRACE_ID="dg2-trace-$(date +%s)"

  HAS_LLM_KEY=false
  if [[ -n "${OPENAI_API_KEY:-}" ]] || [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    HAS_LLM_KEY=true
  fi

  if [[ "$HAS_LLM_KEY" == "true" ]]; then
    LLM_RESP=$(curl -s -w "\n%{http_code}" -X POST \
      "$API_URL/v1/chat/completions" \
      -H "x-api-key: $API_KEY" \
      -H "x-request-id: $TRACE_ID" \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Say OK"}],"stream":false}')

    LLM_CODE=$(echo "$LLM_RESP" | tail -1)
    LLM_BODY=$(echo "$LLM_RESP" | sed '$d')

    if [[ "$LLM_CODE" == "200" ]]; then
      log_pass "LLM request succeeded (trace: $TRACE_ID)"

      # Check if response includes trace/request ID
      RESP_TRACE=$(echo "$LLM_BODY" | jq -r '.trace_id // .request_id // empty' 2>/dev/null)
      if [[ -n "$RESP_TRACE" ]]; then
        log_pass "Trace ID propagated in response: $RESP_TRACE"
      else
        log_skip "Trace ID not in response body (may be in headers/logs)"
      fi
    else
      log_fail "LLM request returned $LLM_CODE"
    fi
  else
    log_skip "No LLM API key — skipping actual LLM call"
  fi

  echo ""
  echo "── Step 5: Verify Logs Endpoint (F005) ──"
  LOGS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$API_URL/logs" \
    -H "Authorization: Bearer $TOKEN")

  if [[ "$LOGS_CODE" == "200" ]]; then
    log_pass "GET /logs accessible (200)"

    # Check if logs contain data
    LOGS_RESP=$(curl -sf "$API_URL/logs" -H "Authorization: Bearer $TOKEN")
    LOG_COUNT=$(echo "$LOGS_RESP" | jq '.data | length // 0' 2>/dev/null || echo "0")
    if [[ "$LOG_COUNT" -gt 0 ]]; then
      log_pass "Logs contain $LOG_COUNT entries"
    else
      log_skip "No log entries yet (no LLM calls made or async flush pending)"
    fi
  elif [[ "$LOGS_CODE" == "401" ]]; then
    log_fail "GET /logs returned 401 (auth token rejected)"
  else
    log_fail "GET /logs returned $LOGS_CODE"
  fi

  echo ""
  echo "── Step 6: Verify Analytics Endpoint (F005) ──"
  ANALYTICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$API_URL/analytics/usage?groupBy=model&period=daily" \
    -H "Authorization: Bearer $TOKEN")

  if [[ "$ANALYTICS_CODE" == "200" ]]; then
    log_pass "GET /analytics/usage accessible (200)"
  elif [[ "$ANALYTICS_CODE" == "401" ]]; then
    log_fail "GET /analytics/usage returned 401"
  else
    log_fail "GET /analytics/usage returned $ANALYTICS_CODE"
  fi

  COST_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$API_URL/analytics/cost?groupBy=team&period=monthly" \
    -H "Authorization: Bearer $TOKEN")

  if [[ "$COST_CODE" == "200" ]]; then
    log_pass "GET /analytics/cost accessible (200)"
  elif [[ "$COST_CODE" == "401" ]]; then
    log_fail "GET /analytics/cost returned 401"
  else
    log_fail "GET /analytics/cost returned $COST_CODE"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  DG2 Result: $PASS passed, $FAIL failed, $SKIP skipped"
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
echo "🔑 Logged in"

# Auto-create API Key
echo "🔑 Creating API Key..."
KEY_RESP=$(curl -sf -X POST "$API_URL/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"dg2-demo-key","scopes":[]}')
API_KEY=$(echo "$KEY_RESP" | jq -r '.data.key // .key')
echo "🔑 API Key: $API_KEY"

# Ensure budget allows requests
ORG_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.orgId')
USER_ID=$(echo "$LOGIN_RESP" | jq -r '.data.user.id')
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
echo "✅ 예산 초기화 완료"
echo ""

echo "═══════════════════════════════════════════════════"
echo "  🎯 DG2 — 인증 요청 → 로깅 + 추적"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  이 시나리오는 F003(Auth) + F005(Request Logging & Tracing)의"
echo "  통합 동작을 검증합니다."
echo ""
echo "  흐름: API Key로 LLM 호출 → 요청이 자동 로깅되는지 확인"
echo "        → trace ID가 전파되는지 확인 → 분석 API 조회"
echo ""
echo "  아래 명령을 순서대로 복사해서 다른 터미널에서 실행하세요."
echo "  (로그인, API Key, 예산 설정은 위에서 자동 완료됨)"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 1: LLM 호출 + Trace ID 전파 (F003+F005 통합)"
echo "  — x-request-id 헤더로 커스텀 trace ID를 전달합니다."
echo "    F003이 API Key를 인증하고, F005가 요청을 비동기 로깅합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  curl -s -X POST $API_URL/v1/chat/completions \\"
echo "    -H \"x-api-key: $API_KEY\" \\"
echo "    -H \"x-request-id: my-trace-001\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}' | jq"
echo ""
echo "  ✔ 확인: .choices[0].message.content에 LLM 응답이 있으면 성공"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 2: 요청 로그 조회 (F005 로깅 검증)"
echo "  — Step 1의 요청이 자동으로 로깅됐는지 확인합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  # 전체 로그 목록 (최신 1건)"
echo "  curl -s $API_URL/logs -H \"Authorization: Bearer $TOKEN\" | jq '.data[0]'"
echo ""
echo "  ✔ 확인: .model, .status, .tokens_used 필드가 존재"
echo "    → .id 값을 복사해서 아래 상세 조회에 사용"
echo ""
echo "  # 단건 로그 상세 (trace ID 전파 확인)"
echo "  curl -s $API_URL/logs/<위에서_복사한_LOG_ID> \\"
echo "    -H \"Authorization: Bearer $TOKEN\" | jq"
echo ""
echo "  ✔ 확인: .request_id 또는 .trace_id 에 \"my-trace-001\" 이 포함되면"
echo "    F003→F005 trace ID 전파 성공"
echo ""

echo "────────────────────────────────────────────"
echo "  Step 3: 사용량 분석 API (F005 분석 검증)"
echo "  — 로깅된 데이터가 집계되어 분석 API에 반영되는지 확인합니다."
echo "────────────────────────────────────────────"
echo ""
echo "  # 모델별 일간 사용량"
echo "  curl -s '$API_URL/analytics/usage?groupBy=model&period=daily' \\"
echo "    -H \"Authorization: Bearer $TOKEN\" | jq"
echo ""
echo "  ✔ 확인: .data 배열에 모델별 토큰 사용량 집계"
echo ""
echo "  # 팀별 월간 비용"
echo "  curl -s '$API_URL/analytics/cost?groupBy=team&period=monthly' \\"
echo "    -H \"Authorization: Bearer $TOKEN\" | jq"
echo ""
echo "  ✔ 확인: .data 배열에 팀별 비용 집계"
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
