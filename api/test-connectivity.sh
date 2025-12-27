#!/bin/bash
echo "Testing API Connectivity..."

echo "1. Checking API Health (Direct Port 8002)..."
HEALTH_8002=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/health)
echo "Status: $HEALTH_8002"
if [ "$HEALTH_8002" == "200" ]; then echo "✅ Success"; else echo "❌ Failed"; fi
echo ""


# Test public tRPC endpoint (config.getConfig)
echo "2. Testing tRPC public endpoint (config.getConfig)..."
TRPC_RESULT=$(curl -s "http://localhost:8080/trpc/config.getConfig?batch=1&input=%7B%7D")
echo "Response: $TRPC_RESULT"
if [[ "$TRPC_RESULT" == *"result"* ]]; then echo "✅ Success"; else echo "❌ Failed"; fi
