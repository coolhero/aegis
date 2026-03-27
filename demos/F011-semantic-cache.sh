#!/bin/bash
# F011 Semantic Cache Demo
# Usage: ./demos/F011-semantic-cache.sh [--ci]

set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

BASE_URL="http://localhost:3000"

echo "=== F011: Semantic Cache Demo ==="
echo ""

if [ "$CI_MODE" = true ]; then
  echo "[CI] Quick health check..."

  npm run build > /dev/null 2>&1
  echo "✅ Build passed"

  npm test > /dev/null 2>&1
  echo "✅ Tests passed"

  echo ""
  echo "✅ F011 CI check complete"
  exit 0
fi

echo "Starting the server..."
echo "Run: npm run start:dev"
echo ""
echo "Once the server is running, try these commands:"
echo ""

echo "--- Step 1: Login ---"
echo "TOKEN=\$(curl -s -X POST $BASE_URL/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"admin@aegis.local\",\"password\":\"admin123\"}' | jq -r .access_token)"
echo ""

echo "--- Step 2: Check Cache Stats ---"
echo "curl -s $BASE_URL/cache/stats \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""

echo "--- Step 3: Set Cache Policy ---"
echo "curl -s -X PUT $BASE_URL/cache/policy/<ORG_ID> \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"similarity_threshold\":0.90,\"ttl_seconds\":3600,\"enabled\":true}' | jq"
echo ""

echo "--- Step 4: Send LLM Request (first = MISS) ---"
echo "curl -s -X POST $BASE_URL/v1/chat/completions \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"model\":\"gpt-4\",\"messages\":[{\"role\":\"user\",\"content\":\"What is AI?\"}]}' -v 2>&1 | grep X-Cache"
echo "# Expected: X-Cache: MISS"
echo ""

echo "--- Step 5: Send Same Request (second = HIT) ---"
echo "curl -s -X POST $BASE_URL/v1/chat/completions \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"model\":\"gpt-4\",\"messages\":[{\"role\":\"user\",\"content\":\"What is AI?\"}]}' -v 2>&1 | grep X-Cache"
echo "# Expected: X-Cache: HIT"
echo ""

echo "--- Step 6: Invalidate Cache ---"
echo "curl -s -X DELETE $BASE_URL/cache \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""

echo "Press Ctrl+C to exit"
read -r
