FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
COPY api/package.json api/pnpm-lock.yaml ./api/
COPY api/tsconfig*.json ./api/
COPY api/nest-cli.json ./api/
COPY libs/shared-types ./libs/shared-types
WORKDIR /app/api
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
COPY --from=deps /pnpm-store /pnpm-store
COPY --from=deps /app/api/node_modules /app/api/node_modules
COPY --from=deps /app/libs /app/libs
COPY api ./api
WORKDIR /app/api
RUN pnpm --dir /app/libs/shared-types install \
 && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app/api
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
ENV NODE_ENV=production
COPY --from=builder /app/api/dist ./dist
COPY api/package.json ./package.json
COPY api/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /pnpm-store /pnpm-store
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate \
  && pnpm config set store-dir /pnpm-store \
  && pnpm install --frozen-lockfile --prod
EXPOSE 8002
USER nestjs
CMD ["pnpm", "start:prod"]

