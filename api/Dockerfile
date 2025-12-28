# syntax=docker/dockerfile:1.7
# --- build ---
ARG BASE_IMAGE=node:22.11-alpine
FROM ${BASE_IMAGE} AS builder
WORKDIR /repo
# Install pnpm directly via npm to avoid corepack signature verification issues
# If CI provides a base image with pnpm already installed, this is a fast no-op.
RUN command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@10.24.0
RUN pnpm config set store-dir /pnpm/store

# Workspace manifest + only what this package needs to resolve deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY api/package.json ./api/
# Copy patches directory before install so pnpm can apply them (required for patchedDependencies in root package.json)
COPY web/patches ./web/patches/

# Install all dependencies first
RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @meriter/shared-types... install --frozen-lockfile && \
    pnpm --filter @meriter/api... install --frozen-lockfile

# Build shared-types first
RUN pnpm --filter @meriter/shared-types build

# Add sources and build API
COPY api ./api
RUN pnpm --filter @meriter/api exec nest build

# Prepare production output
ENV CI=true
# Reinstall with --shamefully-hoist to create traditional node_modules structure
RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @meriter/api... install --prod --frozen-lockfile --ignore-scripts --shamefully-hoist
# Copy built artifacts and production node_modules
RUN mkdir -p /out && \
    cp -R api/dist /out/dist && \
    cp -R libs /out/libs && \
    cp -R web/patches /out/web/ && \
    cp api/package.json /out/package.json && \
    # Copy root node_modules (with --shamefully-hoist, packages are at root level)
    cp -R node_modules /out/node_modules && \
    # Copy shared-types built output
    mkdir -p /out/libs/shared-types && \
    cp -R libs/shared-types/dist /out/libs/shared-types/dist && \
    cp libs/shared-types/package.json /out/libs/shared-types/package.json && \
    # Copy public directory (favicon)
    cp -R api/apps/meriter/public /out/public

# --- run ---
FROM node:22.11-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nestjs && \
    npm install -g pnpm@10.24.0
ENV NODE_ENV=production
ENV CI=true
# Copy built artifacts and production node_modules (from pnpm deploy)
COPY --from=builder --chown=nestjs:nodejs /out ./

# Install production dependencies
RUN pnpm install --prod && \
    rm -f package.json.root pnpm-workspace.yaml pnpm-lock.yaml

USER nestjs
EXPOSE 8002
CMD ["node", "dist/apps/meriter/main"]
