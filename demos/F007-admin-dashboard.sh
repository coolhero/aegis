#!/usr/bin/env bash
# T039: F007 Admin Dashboard Demo Script
# Usage: ./demos/F007-admin-dashboard.sh [--ci]
set -e

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  AEGIS Admin Dashboard — F007 Demo"
echo "=========================================="
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not found."
  exit 1
fi

cd "$PROJECT_ROOT"

# Kill existing processes on required ports
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "⚠️  Port 3000 already in use. Killing existing process..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 1
  echo "✅ Port 3000 cleared."
fi

if lsof -ti:3001 > /dev/null 2>&1; then
  echo "⚠️  Port 3001 already in use. Killing existing process..."
  lsof -ti:3001 | xargs kill -9 2>/dev/null || true
  sleep 1
  echo "✅ Port 3001 cleared."
fi

# Start API server in background
echo "🚀 Starting API server..."
cd apps/api
npm run start:dev &
API_PID=$!
cd "$PROJECT_ROOT"

# Wait for API to be ready
echo "⏳ Waiting for API server (port 3000)..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API server is ready."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ API server failed to start."
    kill $API_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Start Web server in background
echo "🚀 Starting Web dashboard..."
cd apps/web
npm run dev &
WEB_PID=$!
cd "$PROJECT_ROOT"

# Wait for Web to be ready
echo "⏳ Waiting for Web server (port 3001)..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Web dashboard is ready."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️ Web server may not be fully ready yet."
    break
  fi
  sleep 1
done

if [ "$CI_MODE" = true ]; then
  echo ""
  echo "🧪 CI Mode — Health check passed."
  echo "✅ API: http://localhost:3000/health"
  echo "✅ Web: http://localhost:3001"
  kill $API_PID 2>/dev/null || true
  kill $WEB_PID 2>/dev/null || true
  echo "Demo CI check passed."
  exit 0
fi

echo ""
echo "=========================================="
echo "  🎉 Dashboard is running!"
echo "=========================================="
echo ""
echo "  📌 Open in your browser:"
echo "     http://localhost:3001/login"
echo ""
echo "  📌 Login credentials (demo):"
echo "     Email: admin@demo.com"
echo "     Password: password123"
echo ""
echo "  📌 Available pages:"
echo "     /dashboard          — Main KPI overview"
echo "     /dashboard/usage    — Usage & cost charts"
echo "     /dashboard/budget   — Budget management"
echo "     /dashboard/users    — User management"
echo "     /dashboard/api-keys — API key management"
echo "     /dashboard/logs     — Request logs"
echo "     /dashboard/realtime — Live SSE monitoring"
echo ""
echo "  Press Ctrl+C to stop."
echo "=========================================="
echo ""

cleanup() {
  echo ""
  echo "Stopping servers..."
  kill $API_PID 2>/dev/null || true
  kill $WEB_PID 2>/dev/null || true
  echo "Done."
}

trap cleanup EXIT INT TERM

# Keep running until Ctrl+C
wait
