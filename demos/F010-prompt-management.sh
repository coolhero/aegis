#!/bin/bash
# F010 Prompt Management Demo
# Usage: ./demos/F010-prompt-management.sh [--ci]

set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

BASE_URL="http://localhost:3000"

echo "=== F010: Prompt Management Demo ==="
echo ""

if [ "$CI_MODE" = true ]; then
  echo "[CI] Quick health check..."

  npm run build > /dev/null 2>&1
  echo "✅ Build passed"

  npm test > /dev/null 2>&1
  echo "✅ Tests passed"

  echo ""
  echo "✅ F010 CI check complete"
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

echo "--- Step 2: Create Prompt ---"
echo "curl -s -X POST $BASE_URL/prompts \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"name\":\"Customer Support\",\"description\":\"CS 프롬프트\",\"content\":\"{{role}}님, {{topic}}에 대해 {{lang|한국어}}로 답변해주세요.\"}' | jq"
echo ""

echo "--- Step 3: Publish Prompt ---"
echo "curl -s -X POST $BASE_URL/prompts/<PROMPT_ID>/publish \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"version\":1}' | jq"
echo ""

echo "--- Step 4: Resolve with Variables ---"
echo "curl -s -X POST $BASE_URL/prompts/<PROMPT_ID>/resolve \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"variables\":{\"role\":\"전문가\",\"topic\":\"AI 보안\"}}' | jq"
echo "# Expected: \"전문가님, AI 보안에 대해 한국어로 답변해주세요.\""
echo ""

echo "--- Step 5: Update Prompt (New Version) ---"
echo "curl -s -X PUT $BASE_URL/prompts/<PROMPT_ID> \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"content\":\"{{role}}님, {{topic}}에 대해 {{style|간결하게}} {{lang|한국어}}로 답변해주세요.\",\"changeNote\":\"style 변수 추가\"}' | jq"
echo ""

echo "--- Step 6: A/B Test ---"
echo "curl -s -X POST $BASE_URL/prompts/<PROMPT_ID>/ab-test \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"variants\":[{\"version_id\":\"<V1_ID>\",\"weight\":70},{\"version_id\":\"<V2_ID>\",\"weight\":30}]}' | jq"
echo ""

echo "--- Step 7: Check Stats ---"
echo "curl -s $BASE_URL/prompts/<PROMPT_ID>/stats \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""

echo "Press Ctrl+C to exit"
read -r
