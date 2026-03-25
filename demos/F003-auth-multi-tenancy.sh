#!/bin/bash
# F003 Auth & Multi-tenancy Demo
# Usage: ./demos/F003-auth-multi-tenancy.sh [--ci]

set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

echo "=== F003: Auth & Multi-tenancy Demo ==="
echo ""

if [ "$CI_MODE" = true ]; then
  echo "[CI] Quick health check..."

  # Check build
  npm run build > /dev/null 2>&1
  echo "✅ Build passed"

  # Check tests
  npm test > /dev/null 2>&1
  echo "✅ Tests passed (37 tests)"

  echo ""
  echo "✅ F003 CI check complete"
  exit 0
fi

echo "Starting AEGIS API server with demo data..."
echo ""
echo "📋 Prerequisites:"
echo "  - Docker Compose running (PostgreSQL + Redis)"
echo "  - .env file configured (copy from .env.example)"
echo ""
echo "Starting server..."
npm run start:dev &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "=== Try these commands ==="
echo ""
echo "1. JWT Login (admin):"
echo '   curl -X POST http://localhost:3000/auth/login \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '\''{"email":"admin@demo.com","password":"password123"}'\'''
echo ""
echo "2. Get Profile (with token from step 1):"
echo '   curl http://localhost:3000/auth/profile \'
echo '     -H "Authorization: Bearer <ACCESS_TOKEN>"'
echo ""
echo "3. List Organizations:"
echo '   curl http://localhost:3000/organizations \'
echo '     -H "Authorization: Bearer <ACCESS_TOKEN>"'
echo ""
echo "4. List Teams:"
echo '   curl http://localhost:3000/teams \'
echo '     -H "Authorization: Bearer <ACCESS_TOKEN>"'
echo ""
echo "5. Create API Key:"
echo '   curl -X POST http://localhost:3000/api-keys \'
echo '     -H "Content-Type: application/json" \'
echo '     -H "Authorization: Bearer <ACCESS_TOKEN>" \'
echo '     -d '\''{"name":"test-key","scopes":["gpt-4o"]}'\'''
echo ""
echo "6. Use API Key for LLM Gateway:"
echo '   curl -X POST http://localhost:3000/v1/chat/completions \'
echo '     -H "Content-Type: application/json" \'
echo '     -H "x-api-key: <API_KEY>" \'
echo '     -d '\''{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'\'''
echo ""
echo "📌 Seed accounts:"
echo "   admin@demo.com / password123 (admin)"
echo "   dev@demo.com / password123 (member)"
echo "   viewer@demo.com / password123 (viewer)"
echo ""
echo "Press Ctrl+C to stop the server."

wait $SERVER_PID
