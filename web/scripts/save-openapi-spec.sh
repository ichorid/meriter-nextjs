#!/bin/bash

# Script to save OpenAPI spec for offline generation
# Usage: ./scripts/save-openapi-spec.sh [output-file]

OUTPUT_FILE="${1:-api-spec.json}"
API_URL="${OPENAPI_URL:-http://localhost:8002/api-json}"

echo "📥 Fetching OpenAPI spec from ${API_URL}..."

if curl -s --max-time 10 "${API_URL}" > "${OUTPUT_FILE}"; then
    if jq -e '.openapi' "${OUTPUT_FILE}" > /dev/null 2>&1; then
        SIZE=$(wc -c < "${OUTPUT_FILE}")
        echo "✅ OpenAPI spec saved to ${OUTPUT_FILE} (${SIZE} bytes)"
        echo ""
        echo "To generate code from this file:"
        echo "  OPENAPI_FILE=${OUTPUT_FILE} pnpm generate:api"
    else
        echo "❌ Invalid OpenAPI spec - file may be corrupted"
        rm -f "${OUTPUT_FILE}"
        exit 1
    fi
else
    echo "❌ Failed to fetch OpenAPI spec"
    echo "   Make sure API server is running on ${API_URL}"
    exit 1
fi


