#!/usr/bin/env bash
# F008: Provider Fallback & Load Balancing Demo
# Usage: ./demos/F008-provider-fallback.sh [--ci]
set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  AEGIS Provider Fallback — F008 Demo"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

# Kill existing processes
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "Killing existing process on port 3000..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Start API server
echo "Starting API server..."
npm run start:dev &
API_PID=$!

# Wait for API
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "API server ready."
    break
  fi
  if [ $i -eq 30 ]; then echo "API failed to start."; kill $API_PID 2>/dev/null; exit 1; fi
  sleep 1
done

# Get JWT token
TOKEN=$(curl -sf -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Failed to get JWT token."
  kill $API_PID 2>/dev/null; exit 1
fi

if [ "$CI_MODE" = true ]; then
  echo ""
  echo "CI Mode — Health check:"
  curl -sf http://localhost:3000/providers/health \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
  echo ""
  echo "CI check passed."
  kill $API_PID 2>/dev/null
  exit 0
fi

echo ""
echo "=========================================="
echo "  Demo Instructions"
echo "=========================================="
echo ""
echo "1. Check provider health:"
echo "   curl -s http://localhost:3000/providers/health -H 'Authorization: Bearer $TOKEN' | python3 -m json.tool"
echo ""
echo "2. Send LLM request (normal routing):"
echo "   curl -s -X POST http://localhost:3000/v1/chat/completions \\"
echo "     -H 'x-api-key: <your-api-key>' \\"
echo "     -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
echo ""
echo "3. Check X-Fallback-Provider header (when fallback occurs):"
echo "   curl -sv -X POST http://localhost:3000/v1/chat/completions \\"
echo "     -H 'x-api-key: <your-api-key>' \\"
echo "     -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}' 2>&1 | grep Fallback"
echo ""
echo "Press Ctrl+C to stop."

cleanup() { echo ""; echo "Stopping..."; kill $API_PID 2>/dev/null; echo "Done."; }
trap cleanup EXIT INT TERM
wait
