#!/bin/bash
# F004 Token Budget Management Demo
# Usage: ./demos/F004-token-budget.sh [--ci]
#
# Default: Start server → print "Try it" instructions → keep running until Ctrl+C
# --ci:    Build + test + health check → exit

set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

echo "=== F004: Token Budget Management Demo ==="
echo ""

if [ "$CI_MODE" = true ]; then
  echo "[CI] Quick health check..."

  # Build
  npm run build > /dev/null 2>&1
  echo "✅ Build passed"

  # Tests
  npm test > /dev/null 2>&1
  echo "✅ Tests passed"

  # Start server briefly for health check
  npm run start:dev &
  SERVER_PID=$!
  for i in $(seq 1 30); do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
      echo "✅ Health check passed"
      break
    fi
    sleep 1
  done

  # Quick budget API smoke test
  TOKEN=$(curl -s http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.accessToken')

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "http://localhost:3000/budgets/org/$(curl -s http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.user.orgId')" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"token_limit":1000000,"cost_limit_usd":100}')

  if [ "$STATUS" = "200" ]; then
    echo "✅ Budget API responded 200"
  else
    echo "❌ Budget API responded $STATUS"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi

  kill $SERVER_PID 2>/dev/null
  wait $SERVER_PID 2>/dev/null || true

  echo ""
  echo "✅ F004 CI check complete"
  exit 0
fi

# =============================================
# Default mode: Real working demo
# =============================================

echo "Starting AEGIS API server with Token Budget Management..."
echo ""
echo "📋 Prerequisites:"
echo "  - Docker Compose running (docker compose up -d)"
echo "  - .env configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
echo ""
echo "Starting server..."
npm run start:dev &
SERVER_PID=$!

# Wait for server
echo "Waiting for server to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "❌ Server failed to start. Check logs."
    exit 1
  fi
  sleep 1
done

# Auto-login and get token
TOKEN=$(curl -s http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.accessToken')
ORG_ID=$(curl -s http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.user.orgId')
USER_ID=$(curl -s http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.user.id')
TEAM_ID=$(curl -s http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.data.user.teamId')

echo ""
echo "🔑 Logged in as admin@demo.com"
echo "   Org:  $ORG_ID"
echo "   User: $USER_ID"
echo "   Team: $TEAM_ID"
echo ""

echo "============================================"
echo "  🎯 Token Budget Management Demo"
echo "============================================"
echo ""
echo "=== Try these commands ==="
echo ""
echo "────────────────────────────────────────────"
echo "  1. 예산 설정 (Org → Team → User)"
echo "────────────────────────────────────────────"
echo ""
echo "  # Org 예산: 1,000,000 토큰 / \$100"
echo "  curl -X PUT http://localhost:3000/budgets/org/$ORG_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":1000000,\"cost_limit_usd\":100}'"
echo ""
echo "  # Team 예산: 600,000 토큰 / \$60"
echo "  curl -X PUT http://localhost:3000/budgets/team/$TEAM_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":600000,\"cost_limit_usd\":60}'"
echo ""
echo "  # User 예산: 200,000 토큰 / \$20"
echo "  curl -X PUT http://localhost:3000/budgets/user/$USER_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":200000,\"cost_limit_usd\":20}'"
echo ""
echo "────────────────────────────────────────────"
echo "  2. LLM 요청 → 예산 차감 확인"
echo "────────────────────────────────────────────"
echo ""
echo "  # API Key 생성"
echo "  curl -X POST http://localhost:3000/api-keys \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"name\":\"budget-demo\",\"scopes\":[]}'"
echo ""
echo "  # LLM 요청 (API Key 사용)"
echo "  curl -X POST http://localhost:3000/v1/chat/completions \\"
echo "    -H \"x-api-key: <API_KEY>\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
echo ""
echo "  # 예산 조회 → 토큰 차감 확인"
echo "  curl http://localhost:3000/budgets/user/$USER_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""
echo "────────────────────────────────────────────"
echo "  3. 예산 초과 → 429 차단"
echo "────────────────────────────────────────────"
echo ""
echo "  # 예산을 매우 낮게 설정 (10 토큰)"
echo "  curl -X PUT http://localhost:3000/budgets/user/$USER_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":10,\"cost_limit_usd\":0.001}'"
echo ""
echo "  # LLM 요청 → 429 budget_exceeded"
echo "  curl -X POST http://localhost:3000/v1/chat/completions \\"
echo "    -H \"x-api-key: <API_KEY>\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}]}'"
echo ""
echo "────────────────────────────────────────────"
echo "  4. 모델 티어별 예산 (Premium vs Economy)"
echo "────────────────────────────────────────────"
echo ""
echo "  # premium 티어 생성 (GPT-4o 할당)"
echo "  curl -X POST http://localhost:3000/model-tiers \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"name\":\"premium\",\"description\":\"High-cost models\",\"model_ids\":[\"<GPT4O_MODEL_UUID>\"]}'"
echo ""
echo "  # premium 전용 예산 설정 (50,000 토큰)"
echo "  curl -X PUT 'http://localhost:3000/budgets/user/$USER_ID?model_tier_id=<TIER_ID>' \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"token_limit\":50000,\"cost_limit_usd\":5}'"
echo ""
echo "  # premium 소진 시: GPT-4o → 429, gpt-4o-mini → 200"
echo ""
echo "────────────────────────────────────────────"
echo "  5. Redis Fail-Closed 확인"
echo "────────────────────────────────────────────"
echo ""
echo "  # Redis 중단"
echo "  docker stop aegis-redis"
echo ""
echo "  # LLM 요청 → 503 Service Unavailable"
echo "  curl -X POST http://localhost:3000/v1/chat/completions \\"
echo "    -H \"x-api-key: <API_KEY>\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}]}'"
echo ""
echo "  # Redis 복구"
echo "  docker start aegis-redis"
echo ""
echo "============================================"
echo ""
echo "📌 Seed accounts:"
echo "   admin@demo.com / password123 (admin)"
echo "   dev@demo.com / password123 (member)"
echo "   viewer@demo.com / password123 (viewer)"
echo ""
echo "Press Ctrl+C to stop the server."

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
