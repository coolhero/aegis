#!/bin/bash
# F012 Developer Playground Demo
# Usage: ./demos/F012-developer-playground.sh [--ci]

set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

echo "=== F012: Developer Playground Demo ==="
echo ""

if [ "$CI_MODE" = true ]; then
  echo "[CI] Quick health check..."

  npm run build > /dev/null 2>&1
  echo "✅ Build passed"

  npm test > /dev/null 2>&1
  echo "✅ Tests passed"

  echo ""
  echo "✅ F012 CI check complete"
  exit 0
fi

echo "Starting the servers..."
echo ""
echo "1. Start API server:  npm run start:dev"
echo "2. Start Web server:  cd apps/web && npm run dev"
echo ""
echo "Once both servers are running, try these features:"
echo ""
echo "--- Chat ---"
echo "Open http://localhost:3001/playground"
echo "  1. Select a model from the dropdown"
echo "  2. Adjust temperature/max_tokens sliders"
echo "  3. Type a prompt and click Send"
echo "  4. Watch the streaming response"
echo "  5. Click Stop to interrupt streaming"
echo ""
echo "--- Cost Estimation ---"
echo "  - Watch token count update as you type"
echo "  - See estimated cost before sending"
echo "  - After response, see actual tokens and cost"
echo ""
echo "--- Prompt Editor ---"
echo "  1. Switch to 'Prompt Editor' tab"
echo "  2. Select a template from F010"
echo "  3. Fill in variables"
echo "  4. Click Preview → Send"
echo ""
echo "--- Model Compare ---"
echo "  1. Switch to 'Compare' tab"
echo "  2. Select 2-3 models"
echo "  3. Enter a prompt and click Compare"
echo "  4. Watch side-by-side streaming responses"
echo ""
echo "--- API Explorer ---"
echo "Open http://localhost:3001/playground/api-explorer"
echo "  1. Browse API endpoints by category"
echo "  2. Select an endpoint"
echo "  3. Fill in parameters"
echo "  4. Click 'Try it' to make a real API call"
echo ""
echo "Press Ctrl+C to exit"
read -r
