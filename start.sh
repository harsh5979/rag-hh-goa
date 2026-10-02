#!/usr/bin/env bash
set -e

ACTION="${1:-start}"

if [ "$ACTION" = "stop" ]; then
    echo "🛑 Shutting down VoiceRAG Development Environment..."
    docker compose down
    echo "✅ All containers stopped and removed cleanly."
    exit 0
fi

echo "===================================================="
echo "🚀 Starting VoiceRAG Development Environment (Ubuntu/Linux)"
echo "===================================================="

# Ensure docker socket has correct permissions
if [ -S /var/run/docker.sock ] && [ ! -w /var/run/docker.sock ]; then
    echo "⚠️ Fixing docker.sock permissions..."
    sudo chmod 666 /var/run/docker.sock || true
fi

echo "Starting all services (Redis, Backend, Frontend)..."
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

echo ""
echo "✅ Environment is now running!"
echo "🌐 Frontend: http://localhost:3000"
echo "⚙️  Backend:  http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
echo "Streaming logs (Press Ctrl+C to exit log view, containers will keep running):"
docker compose logs -f
