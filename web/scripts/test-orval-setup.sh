#!/bin/bash

# Test script for Orval setup
# This script verifies that the API server is running and the OpenAPI spec is accessible

set -e

echo "🔍 Testing Orval Setup..."
echo ""

# Check if API server is running
echo "1. Checking if API server is running on port 8002..."
if curl -s --max-time 2 http://localhost:8002/api-json > /dev/null 2>&1; then
    echo "   ✅ API server is running"
else
    echo "   ❌ API server is NOT running"
    echo ""
    echo "   Please start the API server first:"
    echo "   cd ../api && pnpm dev:api"
    echo ""
    exit 1
fi

# Check if OpenAPI spec is accessible
echo "2. Checking OpenAPI spec endpoint..."
if curl -s --max-time 2 http://localhost:8002/api-json | jq -e '.openapi' > /dev/null 2>&1; then
    echo "   ✅ OpenAPI spec is accessible and valid"
    SPEC_SIZE=$(curl -s http://localhost:8002/api-json | wc -c)
    echo "   📊 Spec size: ${SPEC_SIZE} bytes"
else
    echo "   ❌ OpenAPI spec is not accessible or invalid"
    echo ""
    echo "   Please check:"
    echo "   - API server is running"
    echo "   - Swagger is configured in main.ts"
    echo "   - Endpoint /api-json is available"
    echo ""
    exit 1
fi

# Check if orval is installed
echo "3. Checking Orval installation..."
if pnpm list orval > /dev/null 2>&1; then
    echo "   ✅ Orval is installed"
    ORVAL_VERSION=$(pnpm list orval --depth=0 2>/dev/null | grep orval | awk '{print $2}' | sed 's/@//')
    echo "   📦 Version: ${ORVAL_VERSION}"
else
    echo "   ❌ Orval is not installed"
    echo ""
    echo "   Please install dependencies:"
    echo "   pnpm install"
    echo ""
    exit 1
fi

# Check if mutator file exists
echo "4. Checking mutator file..."
if [ -f "src/lib/api/generated/mutator.ts" ]; then
    echo "   ✅ Mutator file exists"
else
    echo "   ❌ Mutator file not found"
    echo ""
    echo "   Expected: src/lib/api/generated/mutator.ts"
    echo ""
    exit 1
fi

# Check if orval config exists
echo "5. Checking Orval configuration..."
if [ -f "orval.config.ts" ]; then
    echo "   ✅ Orval config file exists"
else
    echo "   ❌ Orval config file not found"
    echo ""
    exit 1
fi

echo ""
echo "✅ All checks passed! Ready to generate API client."
echo ""
echo "To generate the API client, run:"
echo "  pnpm generate:api"
echo ""


