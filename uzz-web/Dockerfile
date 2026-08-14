# syntax=docker/dockerfile:1.7
ARG BASE_IMAGE=node:22.11-alpine
FROM ${BASE_IMAGE} AS builder
WORKDIR /repo
RUN command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@10.26.2
RUN pnpm config set store-dir /pnpm/store
ENV NEXT_TELEMETRY_DISABLED=1
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY uzz-web/package.json ./uzz-web/
RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @meriter/uzz-web... install --frozen-lockfile
COPY uzz-web ./uzz-web
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=cache,target=/pnpm/store \
    --mount=type=cache,target=/repo/uzz-web/.next/cache \
    pnpm -C uzz-web build

FROM node:22.11-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nextjs
ENV NODE_ENV=production
ENV PORT=8004
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /repo/uzz-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/uzz-web/.next/static ./uzz-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/uzz-web/public ./uzz-web/public
USER nextjs
EXPOSE 8004
CMD ["node", "uzz-web/server.js"]
