# syntax=docker/dockerfile:1

# Stage 1: Build application
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm config set store-dir /pnpm-store

WORKDIR /app/api

## Copy api package files and shared library
COPY api/package.json api/pnpm-lock.yaml ./
COPY api/tsconfig*.json ./
COPY api/nest-cli.json ./
COPY libs/shared-types /app/libs/shared-types

# Install strictly per lockfile
RUN pnpm install --frozen-lockfile

## Copy source code
COPY api/apps ./apps
COPY api/libs ./libs

# Build application
RUN pnpm build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

## Copy package files and install production dependencies only
COPY api/package.json api/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

## Copy built application from builder
COPY --from=builder --chown=nestjs:nestjs /app/api/dist ./dist

USER nestjs

EXPOSE 8002

ENV PORT=8002
ENV NODE_ENV=production

CMD ["node", "dist/apps/meriter/main"]

