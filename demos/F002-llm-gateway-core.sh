#!/bin/bash
set -e

echo "=== AEGIS LLM Gateway Core Demo ==="
echo ""

# Check for API keys
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "WARNING: No API keys found in environment."
  echo "Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY"
  echo ""
fi

echo "Starting infrastructure..."
cd "$(dirname "$0")/.."
docker compose up -d postgres redis
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo "Starting API server..."
cp .env.example .env 2>/dev/null || true

# Append API keys to .env if they exist in environment
if [ -n "$OPENAI_API_KEY" ]; then
  grep -q "^OPENAI_API_KEY=" .env 2>/dev/null || echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .env
fi
if [ -n "$ANTHROPIC_API_KEY" ]; then
  grep -q "^ANTHROPIC_API_KEY=" .env 2>/dev/null || echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> .env
fi

npm run start:dev &
APP_PID=$!
sleep 8

echo ""
echo "AEGIS LLM Gateway is running!"
echo ""
echo "=== Test Commands ==="
echo ""
echo "1. Non-streaming (OpenAI model):"
echo '  curl -s http://localhost:3000/v1/chat/completions \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"model":"gpt-4o","messages":[{"role":"user","content":"Say hello in one sentence."}],"stream":false}'"'"' | jq'
echo ""
echo "2. Streaming (OpenAI model):"
echo '  curl -N http://localhost:3000/v1/chat/completions \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"model":"gpt-4o","messages":[{"role":"user","content":"Count from 1 to 5."}],"stream":true}'"'"''
echo ""
echo "3. Non-streaming (Anthropic model):"
echo '  curl -s http://localhost:3000/v1/chat/completions \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"model":"claude-sonnet-4-20250514","messages":[{"role":"system","content":"You are a helpful assistant."},{"role":"user","content":"Say hello in one sentence."}],"stream":false}'"'"' | jq'
echo ""
echo "4. Streaming (Anthropic model):"
echo '  curl -N http://localhost:3000/v1/chat/completions \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Count from 1 to 5."}],"stream":true}'"'"''
echo ""
echo "5. Health check:"
echo "  curl http://localhost:3000/health | jq"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $APP_PID 2>/dev/null; docker compose down; exit 0" INT
wait $APP_PID
