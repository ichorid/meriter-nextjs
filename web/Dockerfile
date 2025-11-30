# --- build ---
FROM node:22.11-alpine AS builder
WORKDIR /repo
# Install pnpm directly via npm to avoid corepack signature verification issues
RUN npm install -g pnpm@10.24.0
ENV NEXT_TELEMETRY_DISABLED=1

# Accept build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_DOMAIN=${NEXT_PUBLIC_DOMAIN}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY web/package.json ./web/
# Copy patches directory before install so pnpm can apply them
COPY web/patches ./web/patches/
RUN pnpm --filter @meriter/web... install --frozen-lockfile

COPY web ./web
# Manually apply patch to fix Flow syntax in @react-native/assets-registry
# Replace the file with a version without Flow syntax
RUN cat > node_modules/.pnpm/@react-native+assets-registry@0.76.9/node_modules/@react-native/assets-registry/registry.js << 'ENDOFFILE'
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
* @flow strict
* @format
*/

'use strict';

const assets = [];

function registerAsset(asset) {
// `push` returns new array length, so the first asset will
// get id 1 (not 0) to make the value truthy
return assets.push(asset);
}

function getAssetByID(assetId) {
return assets[assetId - 1];
}

// eslint-disable-next-line @react-native/monorepo/no-commonjs-exports
module.exports = {registerAsset, getAssetByID};
ENDOFFILE
# Increase Node.js memory limit for build (6GB) - required for Gluestack UI + React Native Web
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN pnpm -C web build

# --- run ---
FROM node:22.11-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nextjs
ENV NODE_ENV=production
ENV PORT=8001
ENV HOSTNAME=0.0.0.0

# Next.js standalone expects these exact locations:
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/web/public ./web/public

USER nextjs
EXPOSE 8001
# Security: Run as non-root user (nextjs)
# Note: read_only filesystem and tmpfs should be configured in docker-compose.yml
CMD ["node", "web/server.js"]
