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

# CRITICAL: Install React and react-dom as production dependencies
# Next.js externalizes React in standalone builds, but the pnpm structure in standalone
# may not be resolvable at runtime. Installing React via npm ensures proper resolution.
# This adds ~50MB but ensures React is accessible (total ~376MB vs ~1.14GB)
RUN cd /app && npm install react@19.2.3 react-dom@19.2.3 --save --save-exact --no-package-lock --legacy-peer-deps && \
    cd /app/web && npm install react@19.2.3 react-dom@19.2.3 --save --save-exact --no-package-lock --legacy-peer-deps && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 8001
# Security: Run as non-root user (nextjs)
# Note: read_only filesystem and tmpfs should be configured in docker-compose.yml
CMD ["node", "web/server.js"]
