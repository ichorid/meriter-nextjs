# --- build ---
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# Workspace manifest + only what this package needs to resolve deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY api/package.json ./api/

# Install all dependencies first
RUN pnpm --filter @meriter/shared-types... install --frozen-lockfile && \
    pnpm --filter @meriter/api... install --frozen-lockfile

# Build shared-types first
RUN pnpm --filter @meriter/shared-types build

# Add sources and build API (skip prebuild since shared-types already built)
COPY api ./api
RUN pnpm --filter @meriter/api exec nest build

# Deploy production dependencies with flattened structure
ENV CI=true
RUN mkdir -p /out && \
    pnpm -C api deploy --filter=@meriter/api --prod --legacy ./deploy && \
    mv api/deploy/node_modules /out/node_modules && \
    mv api/deploy/* /out/ 2>/dev/null || true && \
    cp -R api/dist /out/dist && \
    cp api/package.json /out/package.json && \
    cp pnpm-lock.yaml /out/pnpm-lock.yaml && \
    rm -rf api/deploy

# --- run ---
FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nestjs
ENV NODE_ENV=production
COPY --from=builder --chown=nestjs:nodejs /out ./
USER nestjs
EXPOSE 8002
CMD ["node", "dist/apps/meriter/main"]
