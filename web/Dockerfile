# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store

WORKDIR /app/web

# Copy manifests first for caching
COPY web/package.json web/pnpm-lock.yaml ./
# Provide link target for shared-types
COPY libs/shared-types /app/libs/shared-types

# Install strictly per lockfile (uses link:../libs/shared-types)
RUN pnpm install --frozen-lockfile

# Copy the rest of the web sources
COPY web ./

# Build Next.js application
RUN pnpm build

# Stage 3: Production runtime
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

## Copy necessary files from built web app
COPY --from=builder /app/web/next.config.js ./
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/package.json ./package.json

## Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/web/.next ./.next
COPY --from=builder /app/web/node_modules ./node_modules

## Copy source directory (required for App Router)
COPY --from=builder --chown=nextjs:nodejs /app/web/src ./src

## Copy styles directory
## Optional assets (commented out if not present)
# COPY --from=builder --chown=nextjs:nodejs /app/web/styles ./styles

## Copy config directory if it exists
# COPY --from=builder --chown=nextjs:nodejs /app/web/config ./config

USER nextjs

EXPOSE 8001

ENV PORT=8001
ENV NODE_ENV=production

CMD ["pnpm", "start"]

