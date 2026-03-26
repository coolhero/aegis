#!/usr/bin/env bash
set -euo pipefail

# F005 — Request Logging & Tracing Demo
# Usage: ./demos/F005-logging.sh [--ci]

CI_MODE=false
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=true
fi

API_URL="http://localhost:3000"
API_KEY="${AEGIS_API_KEY:-}"

echo "═══════════════════════════════════════════════════"
echo "  F005 — Request Logging & Tracing Demo"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if server is running
if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
  echo "Starting AEGIS server..."
  cd "$(dirname "$0")/.."
  npm run start:dev &
  SERVER_PID=$!

  echo "Waiting for server to be ready..."
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

if [[ "$CI_MODE" == "true" ]]; then
  echo ""
  echo "[CI] Health check passed"

  # Quick smoke test — check /logs endpoint exists
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/logs" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "200" ]]; then
    echo "[CI] GET /logs endpoint accessible (HTTP $HTTP_CODE)"
  else
    echo "[CI] ERROR: GET /logs returned $HTTP_CODE"
    exit 1
  fi

  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/analytics/usage?groupBy=model&period=daily" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "200" ]]; then
    echo "[CI] GET /analytics/usage endpoint accessible (HTTP $HTTP_CODE)"
  else
    echo "[CI] ERROR: GET /analytics/usage returned $HTTP_CODE"
    exit 1
  fi

  echo "[CI] F005 smoke test PASSED"
  exit 0
fi

# Interactive demo
echo ""
echo "═══ Try it! ═══════════════════════════════════════"
echo ""
echo "1. Send an LLM request (generates a RequestLog):"
echo "   curl -X POST $API_URL/v1/chat/completions \\"
echo "     -H 'x-api-key: <your-api-key>' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\": \"gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"
echo ""
echo "2. View logs:"
echo "   curl $API_URL/logs -H 'Authorization: Bearer <jwt>'"
echo ""
echo "3. View log details:"
echo "   curl $API_URL/logs/<log-id> -H 'Authorization: Bearer <jwt>'"
echo ""
echo "4. Usage analytics (model × daily):"
echo "   curl '$API_URL/analytics/usage?groupBy=model&period=daily' \\"
echo "     -H 'Authorization: Bearer <jwt>'"
echo ""
echo "5. Cost analytics (team × monthly):"
echo "   curl '$API_URL/analytics/cost?groupBy=team&period=monthly' \\"
echo "     -H 'Authorization: Bearer <jwt>'"
echo ""
echo "═══════════════════════════════════════════════════"
echo "Server running at $API_URL — Press Ctrl+C to stop"
echo ""

# Keep running until Ctrl+C
wait
