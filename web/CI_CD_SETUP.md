# CI/CD Setup for Orval Code Generation

## Overview

This document describes how to integrate Orval code generation into your CI/CD pipeline.

## Option 1: Generate During Build (Recommended)

Add generation to pre-build step in `package.json`:

```json
{
  "scripts": {
    "prebuild": "pnpm generate:api || echo 'Warning: API generation skipped'",
    "build": "next build"
  }
}
```

**Pros:**
- Always up-to-date
- Fails build if generation fails

**Cons:**
- Requires API server running during build
- Slower build times

## Option 2: Generate from Saved Spec File

Save OpenAPI spec and commit it:

```bash
# Save spec
curl http://localhost:8002/api-json > api-spec.json

# Generate from file
OPENAPI_FILE=./api-spec.json pnpm generate:api
```

**Pros:**
- No server needed during build
- Faster builds
- Reproducible

**Cons:**
- Need to manually update spec file
- Can get out of sync

## Option 3: GitHub Actions Workflow

Use the provided workflow (`.github/workflows/generate-api.yml`):

- Runs on schedule (daily)
- Runs when API code changes
- Can create PRs with updated generated code

## Recommended Approach

**For Development:**
- Generate on-demand: `pnpm generate:api`
- Use watch mode: `pnpm generate:api:watch`

**For CI/CD:**
- Option 1: Generate during build (if API server available)
- Option 2: Use saved spec file (if server not available)
- Option 3: Use GitHub Actions to keep spec updated

## Docker Build Considerations

If building in Docker:

1. **Multi-stage build**: Generate in one stage, build in another
2. **Use saved spec**: Commit `api-spec.json` and use it
3. **Build API first**: Build API, then generate, then build web

Example Dockerfile:
```dockerfile
# Stage 1: Generate API client
FROM node:22 AS generator
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml ./web/
COPY api-spec.json ./web/
RUN cd web && pnpm install --frozen-lockfile
RUN cd web && OPENAPI_FILE=./api-spec.json pnpm generate:api

# Stage 2: Build web app
FROM node:22 AS builder
WORKDIR /app
COPY web/ ./
COPY --from=generator /app/web/src/lib/api/generated ./src/lib/api/generated
RUN pnpm install --frozen-lockfile
RUN pnpm build
```

## Verification

Add to CI pipeline:
```yaml
- name: Verify generated code
  run: |
    cd web
    pnpm tsc --noEmit
    # Check that generated files exist
    test -f src/lib/api/generated/publications.ts
```


