# syntax=docker/dockerfile:1.7
ARG BASE_IMAGE=node:22.11-alpine
FROM ${BASE_IMAGE} AS builder
WORKDIR /repo
RUN command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@10.26.2
RUN pnpm config set store-dir /pnpm/store
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY community-web/package.json ./community-web/
RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @meriter/community-web... install --frozen-lockfile
COPY community-web ./community-web
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=cache,target=/pnpm/store \
    --mount=type=cache,target=/repo/community-web/.next/cache \
    pnpm -C community-web build

FROM node:22.11-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nextjs
ENV NODE_ENV=production
ENV PORT=8003
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /repo/community-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/community-web/.next/static ./community-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/community-web/public ./community-web/public
USER nextjs
EXPOSE 8003
CMD ["node", "community-web/server.js"]
