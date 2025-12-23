# --- build ---
FROM node:22.11-alpine AS builder
WORKDIR /repo
# Install pnpm directly via npm to avoid corepack signature verification issues
RUN npm install -g pnpm@10.24.0
ENV NEXT_TELEMETRY_DISABLED=1

# Accept build arguments for Next.js public environment variables
# Note: Domain is detected at runtime from window.location, no build-time variable needed
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY web/package.json ./web/
# Copy patches directory before install so pnpm can apply them
COPY web/patches ./web/patches/
RUN pnpm --filter @meriter/web... install --frozen-lockfile

COPY web ./web
# Patch is automatically applied by pnpm via patchedDependencies in root package.json
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

# Install pnpm for minimal dependency installation
RUN npm install -g pnpm@10.24.0

# Copy Next.js standalone output (includes most dependencies)
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/web/public ./web/public

# OPTIMIZATION: Copy React and react-dom from standalone output to both root and web node_modules
# Next.js externalizes React in standalone builds, but the pnpm structure in standalone
# may not be resolvable at runtime. Copying React directly ensures proper resolution.
# This adds minimal size (~50MB) but ensures React is accessible (total ~371MB vs ~1.14GB)
RUN mkdir -p /app/node_modules /app/web/node_modules && \
    # Find and copy React from standalone's node_modules (already copied above)
    REACT_SRC=$(find /app/node_modules/.pnpm -type d -path "*/react@*/node_modules/react" 2>/dev/null | head -1) && \
    REACT_DOM_SRC=$(find /app/node_modules/.pnpm -type d -path "*/react-dom@*/node_modules/react-dom" 2>/dev/null | head -1) && \
    if [ -n "$REACT_SRC" ] && [ -d "$REACT_SRC" ]; then \
        cp -r "$REACT_SRC" /app/node_modules/react && \
        cp -r "$REACT_SRC" /app/web/node_modules/react; \
    fi && \
    if [ -n "$REACT_DOM_SRC" ] && [ -d "$REACT_DOM_SRC" ]; then \
        cp -r "$REACT_DOM_SRC" /app/node_modules/react-dom && \
        cp -r "$REACT_DOM_SRC" /app/web/node_modules/react-dom; \
    fi && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 8001
# Security: Run as non-root user (nextjs)
# Note: read_only filesystem and tmpfs should be configured in docker-compose.yml
CMD ["node", "web/server.js"]
