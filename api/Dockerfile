# syntax=docker/dockerfile:1

# Stage 1: Build application
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps ./apps
COPY libs ./libs

# Build application
RUN pnpm build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist

USER nestjs

EXPOSE 8002

ENV PORT=8002
ENV NODE_ENV=production

CMD ["node", "dist/apps/meriter/main"]

