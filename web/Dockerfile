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

# OPTIMIZATION: Next.js standalone output already includes all necessary dependencies
# including React in its node_modules. We just need to copy the standalone output.
# This is much more efficient than installing all production dependencies (~250MB vs ~1.14GB)
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/web/public ./web/public

USER nextjs
EXPOSE 8001
# Security: Run as non-root user (nextjs)
# Note: read_only filesystem and tmpfs should be configured in docker-compose.yml
CMD ["node", "web/server.js"]
