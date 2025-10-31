FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store
# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all workspace package.json files
COPY web/package.json ./web/
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
# Copy web source code (overwrites everything we need to rebuild)
COPY web ./web
WORKDIR /app/web
RUN pnpm approve-builds @nestjs/core bcrypt sharp mongodb-memory-server && \
    pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
ENV PORT=8001
ENV HOSTNAME=0.0.0.0
# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/web/public ./web/web/public
# Copy package files for traceability
COPY --chown=nextjs:nodejs web/package.json ./web/web/package.json
COPY --chown=nextjs:nodejs pnpm-lock.yaml ./web/web/pnpm-lock.yaml
EXPOSE 8001
USER nextjs
WORKDIR /app/web/web
CMD ["node", "server.js"]
