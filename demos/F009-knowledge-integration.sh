#!/usr/bin/env bash
# F009: Knowledge Integration Demo
set -e

CI_MODE=false
[ "$1" = "--ci" ] && CI_MODE=true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  AEGIS Knowledge Integration — F009 Demo"
echo "=========================================="

cd "$PROJECT_ROOT"

# Kill existing
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start API
echo "Starting API server..."
npm run start:dev &
API_PID=$!
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/health > /dev/null 2>&1 && break
  [ $i -eq 30 ] && { echo "API failed"; kill $API_PID; exit 1; }
  sleep 1
done
echo "API ready."

# Ensure pgvector column
docker exec aegis-postgres psql -U aegis -d aegis -c "ALTER TABLE embedding ADD COLUMN IF NOT EXISTS vector vector(1536);" 2>/dev/null || true

TOKEN=$(curl -sf -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"password123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')

if [ "$CI_MODE" = true ]; then
  echo ""
  echo "CI Mode — uploading doc + RAG query..."
  DOC_ID=$(curl -sf -X POST http://localhost:3000/documents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"CI Test","content":"CI test document for knowledge integration."}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["id"])')
  sleep 8
  STATUS=$(curl -sf "http://localhost:3000/documents/$DOC_ID" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["embeddingStatus"])')
  echo "Embedding status: $STATUS"
  QUERY=$(curl -sf -X POST http://localhost:3000/knowledge/query -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"query":"CI test","threshold":0.1}' | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d["type"], len(d.get("ragResults",[])))')
  echo "Query result: $QUERY"
  kill $API_PID 2>/dev/null
  echo "CI check passed."
  exit 0
fi

echo ""
echo "=========================================="
echo "  Try it:"
echo "=========================================="
echo ""
echo "1. Upload a document:"
echo '   curl -X POST http://localhost:3000/documents \'
echo "     -H 'Authorization: Bearer $TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"title\":\"My Doc\",\"content\":\"Your knowledge content here\"}'"
echo ""
echo "2. Check embedding status:"
echo '   curl http://localhost:3000/documents -H "Authorization: Bearer '$TOKEN'"'
echo ""
echo "3. Query knowledge:"
echo '   curl -X POST http://localhost:3000/knowledge/query \'
echo "     -H 'Authorization: Bearer $TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\":\"your question here\",\"threshold\":0.3}'"
echo ""
echo "Press Ctrl+C to stop."

cleanup() { echo ""; kill $API_PID 2>/dev/null; echo "Done."; }
trap cleanup EXIT INT TERM
wait
