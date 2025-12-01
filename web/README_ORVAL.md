# Orval API Client Generation

## 🎯 Overview

This project uses **Orval** to automatically generate TypeScript types and React Query hooks from the OpenAPI specification. This provides:

- **Type Safety**: Full TypeScript types from OpenAPI spec
- **Code Reduction**: ~10x reduction in API client code
- **Auto-sync**: Generated code stays in sync with API changes
- **Developer Experience**: Better autocomplete and type checking

## 🚀 Quick Start

### Generate API Client

**Prerequisites**: API server must be running on port 8002

```bash
# Start API server (Terminal 1)
cd /home/vader/MY_SRC/meriter-nextjs
pnpm dev:api

# Wait for server to start, then generate (Terminal 2)
cd web
pnpm generate:api
```

**Alternative**: Use saved OpenAPI spec file
```bash
# Save spec when server is running
./scripts/save-openapi-spec.sh api-spec.json

# Generate from file
OPENAPI_FILE=./api-spec.json pnpm generate:api
```

### Review Generated Code

After generation, check:
```bash
ls -la src/lib/api/generated/
# Should see: publications/, comments/, communities/, etc.
```

## 📁 Key Files

### Configuration
- `orval.config.ts` - Orval configuration
- `src/lib/api/wrappers/mutator.ts` - Custom axios instance with response unwrapping

### Generated Code
- `src/lib/api/generated/` - Generated hooks and types (one directory per API resource)
- `src/lib/api/generated/meriterAPI.schemas.ts` - TypeScript types from OpenAPI

### API Wrappers
- `src/lib/api/wrappers/*-api.ts` - Thin wrappers around generated functions
- `src/lib/api/wrappers/index.ts` - Centralized exports

### Scripts
- `scripts/save-openapi-spec.sh` - Save OpenAPI spec for offline generation
- `scripts/test-orval-setup.sh` - Verify Orval setup

## 🔧 Configuration Details

### Mutator (`src/lib/api/wrappers/mutator.ts`)
- Handles API response format: `{ success: true, data: ... }` → unwraps to `data`
- Includes `withCredentials: true` for cookie authentication
- Error handling interceptors (401 handling, etc.)

### Orval Config (`orval.config.ts`)
- Generates React Query hooks
- Supports infinite queries with `page` parameter
- Splits by tags (one file per API resource)
- Sets `staleTime: 30000` (30 seconds)

## 📊 How It Works

1. **Backend** exposes OpenAPI spec at `/api-json` endpoint
2. **Orval** reads the spec and generates:
   - TypeScript types for all DTOs
   - React Query hooks for all endpoints
   - API client functions
3. **Mutator** handles response unwrapping and authentication
4. **Wrappers** provide a clean interface around generated functions
5. **Hooks** use wrappers and add business logic (validation, cache invalidation, etc.)

## 🐛 Troubleshooting

### Server Not Running
```bash
# Check if server is running
curl http://localhost:8002/api-json

# Start server
cd ../api && pnpm dev:api
```

### Generation Fails
1. Check API server is running
2. Verify `/api-json` endpoint accessible
3. Check Orval config in `orval.config.ts`
4. Review error messages

### Type Errors After Generation
1. Ensure OpenAPI spec is up-to-date
2. Check Swagger decorators on controllers
3. Verify mutator handles response format correctly

### Test Setup
```bash
./scripts/test-orval-setup.sh
```

## 🔄 Regenerating Code

When the API changes:

1. **Update API**: Modify controllers/DTOs with Swagger decorators
2. **Regenerate**: Run `pnpm generate:api` (or use saved spec file)
3. **Types Update**: Generated types automatically reflect changes
4. **No Breaking Changes**: Existing hooks continue to work through wrappers

## 📝 Build Integration

Code generation is integrated into the build process:

```json
{
  "scripts": {
    "prebuild": "pnpm generate:api || echo 'Warning: API generation skipped'",
    "generate:api": "orval",
    "generate:api:from-file": "OPENAPI_FILE=./api-spec.json pnpm generate:api"
  }
}
```

For CI/CD, see `CI_CD_SETUP.md` for detailed integration options.

## 🔗 Related Documentation

- [Orval Documentation](https://orval.dev/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- `CI_CD_SETUP.md` - CI/CD integration guide
