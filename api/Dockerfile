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
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
# Deploy production dependencies with flattened structure
COPY --from=deps --chown=nestjs:nodejs /app ./
WORKDIR /app/api
RUN pnpm deploy --filter=@meriter/api --prod --legacy ./deploy
# Copy from deployment and remove temporary files
RUN mkdir /app/final && \
    mv /app/api/deploy/node_modules /app/final/node_modules && \
    mv /app/api/deploy/* /app/final/ 2>/dev/null || true && \
    rm -rf /app/api /app/libs /app/web /app/node_modules /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml
WORKDIR /app/final
COPY --from=builder --chown=nestjs:nodejs /app/api/dist ./dist
# Copy package files for traceability
COPY --chown=nestjs:nodejs api/package.json ./package.json
COPY --chown=nestjs:nodejs pnpm-lock.yaml ./pnpm-lock.yaml
EXPOSE 8002
USER nestjs
CMD ["node", "dist/apps/meriter/main"]
