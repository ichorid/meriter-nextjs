FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all workspace package.json files
COPY api/package.json ./api/
COPY libs/shared-types/package.json ./libs/shared-types/
# Copy entire libs/shared-types directory
COPY libs/shared-types ./libs/shared-types
# Install all dependencies
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
# Copy everything from deps including node_modules
COPY --from=deps /app ./
# Copy api source code (overwrites everything we need to rebuild)
COPY api ./api
WORKDIR /app/api
RUN pnpm approve-builds @nestjs/core bcrypt sharp mongodb-memory-server && \
    pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
ENV NODE_ENV=production
# Copy production dependencies only
COPY --from=deps --chown=nestjs:nodejs /app/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/api/dist ./dist
# Copy package files for traceability
COPY --chown=nestjs:nodejs api/package.json ./package.json
COPY --chown=nestjs:nodejs pnpm-lock.yaml ./pnpm-lock.yaml
EXPOSE 8002
USER nestjs
CMD ["node", "dist/apps/meriter/main"]
