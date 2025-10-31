FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
COPY web/package.json web/pnpm-lock.yaml ./web/
COPY libs/shared-types ./libs/shared-types
WORKDIR /app/web
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
COPY --from=deps /pnpm-store /pnpm-store
COPY --from=deps /app/web/node_modules /app/web/node_modules
COPY --from=deps /app/libs /app/libs
COPY web ./web
WORKDIR /app/web
# Ensure shared-types deps are installed for prebuild
RUN pnpm --dir /app/libs/shared-types install \
 && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
ENV PORT=8001
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/web/.next/standalone ./web
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public
EXPOSE 8001
USER nextjs
WORKDIR /app/web/web
CMD ["node", "server.js"]

