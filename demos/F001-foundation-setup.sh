#!/bin/bash
set -e

echo "=== AEGIS Foundation Setup Demo ==="
echo ""
echo "Starting infrastructure..."
docker compose up -d postgres redis
sleep 3

echo ""
echo "Starting API server..."
cp .env.example .env 2>/dev/null || true
npm run start:dev &
APP_PID=$!
sleep 5

echo ""
echo "AEGIS API is running!"
echo ""
echo "Try these:"
echo "  curl http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $APP_PID 2>/dev/null; docker compose down; exit 0" INT
wait $APP_PID
