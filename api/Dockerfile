# --- build ---
FROM node:22.11-alpine AS builder
WORKDIR /repo
# Install pnpm directly via npm to avoid corepack signature verification issues
RUN npm install -g pnpm@10.24.0

# Workspace manifest + only what this package needs to resolve deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/shared-types ./libs/shared-types
COPY api/package.json ./api/
# Copy patches directory before install so pnpm can apply them (required for patchedDependencies in root package.json)
COPY web/patches ./web/patches/

# Install all dependencies first
RUN pnpm --filter @meriter/shared-types... install --frozen-lockfile && \
    pnpm --filter @meriter/api... install --frozen-lockfile

# Build shared-types first
RUN pnpm --filter @meriter/shared-types build

# Add sources and build API
COPY api ./api
RUN pnpm --filter @meriter/api exec nest build

# Prepare production output - copy only what's needed for install
RUN mkdir -p /out/web && \
    cp -R api/dist /out/dist && \
    cp -R libs /out/libs && \
    cp -R web/patches /out/web/ && \
    cp api/package.json /out/package.json && \
    cp pnpm-lock.yaml /out/pnpm-lock.yaml && \
    cp pnpm-workspace.yaml /out/pnpm-workspace.yaml && \
    cp package.json /out/package.json.root

# --- run ---
FROM node:22.11-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S -G nodejs nestjs && \
    npm install -g pnpm@10.24.0
ENV NODE_ENV=production

# Copy build artifacts and package files
COPY --from=builder --chown=nestjs:nodejs /out ./

# Install production dependencies
RUN pnpm install --prod && \
    rm -f package.json.root pnpm-workspace.yaml pnpm-lock.yaml

USER nestjs
EXPOSE 8002
CMD ["node", "dist/apps/meriter/main"]
