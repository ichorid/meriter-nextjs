# Local Development Guide

This guide explains how to run the Meriter application locally for development.

## Architecture

The application uses **direct Caddy routing** in production:
- Browser → Caddy → NestJS Backend (`/api/*`)
- Browser → Caddy → Next.js Frontend (everything else)

For local development, we bypass Caddy and run services directly.

## Prerequisites

- Node.js (v18+)
- MongoDB (running locally on `mongodb://127.0.0.1:27017`)
- pnpm or npm

## Local Development Setup

You have **two options** for local development:

### Option 1: With Caddy (Recommended - Production Parity)

This setup mirrors production and avoids CORS issues.

#### 1.1. Install Dependencies

```bash
# Install backend dependencies
cd api
npm install

# Install frontend dependencies
cd ../web
npm install

# Install Caddy
sudo apt install caddy  # Debian/Ubuntu
# OR
brew install caddy      # macOS
```

#### 1.2. Configure Environment Variables

```bash
# Backend environment
cp api/env.example api/.env

# Frontend environment
cp web/env.example web/.env
```

**Required Configuration:**

**`api/.env`:**
```bash
MONGO_URL=mongodb://127.0.0.1:27017/meriter
BOT_TOKEN=your_telegram_bot_token_from_botfather
BOT_USERNAME=your_bot_username
```

**`web/.env`:**
```bash
MONGO_URL=mongodb://127.0.0.1:27017/meriter
BOT_TOKEN=your_telegram_bot_token_from_botfather
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
JWT_SECRET=your-secure-jwt-secret
```

#### 1.3. Start Services

Open **three** terminal windows:

**Terminal 1 - Backend (NestJS):**
```bash
cd api
npm run dev
```
- Runs on `http://localhost:8002`

**Terminal 2 - Frontend (Next.js):**
```bash
cd web
npm run dev
```
- Runs on `http://localhost:8001`

**Terminal 3 - Caddy:**
```bash
caddy run --config Caddyfile.local
```
- Runs on `http://localhost:8080`
- Routes `/api/*` to backend (8002)
- Routes everything else to frontend (8001)
- No root/sudo required (non-privileged port)

#### 1.4. Access the Application

Open your browser to: **`http://localhost:8080`**

✅ All API calls work correctly  
✅ No CORS issues  
✅ Matches production behavior  

---

### Option 2: Without Caddy (Direct CORS)

This is simpler but has known issues with relative API URLs.

#### 2.1. Install Dependencies

```bash
# Install backend dependencies
cd api
npm install

# Install frontend dependencies
cd ../web
npm install
```

#### 2.2. Configure Environment Variables

```bash
# Backend environment
cp api/env.example api/.env

# Frontend environment  
cp web/env.example web/.env
```

**Key settings:**

**`api/.env`:**
```bash
MONGO_URL=mongodb://127.0.0.1:27017/meriter
BOT_TOKEN=your_telegram_bot_token_from_botfather
BOT_USERNAME=your_bot_username
```

**`web/.env`:**
```bash
MONGO_URL=mongodb://127.0.0.1:27017/meriter
BOT_TOKEN=your_telegram_bot_token_from_botfather
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
JWT_SECRET=your-secure-jwt-secret
```

#### 2.3. Start Services

Open two terminal windows:

**Terminal 1 - Backend (NestJS):**
```bash
cd api
npm run dev
```
- Runs on `http://localhost:8002`

**Terminal 2 - Frontend (Next.js):**
```bash
cd web
npm run dev
```
- Runs on `http://localhost:8001`

#### 2.4. Access the Application

Open your browser to: **`http://localhost:8001`**

⚠️ **Known Issues:**
- API calls will fail with 404 errors (frontend uses relative URLs that resolve to Next.js instead of NestJS)
- CORS errors (CORS has been removed since production uses Caddy)
- **Use Option 1 (Caddy) instead** - this option is only documented for reference

## How It Works

### Development with Caddy (Option 1 - Recommended)

```
Browser → http://localhost:8080 (Caddy)
         ↓
         ├→ /api/* → localhost:8002 (NestJS)
         └→ /* → localhost:8001 (Next.js)
```

Same routing as production, just using localhost instead of Docker service names.
No root/sudo required - runs on non-privileged port 8080.

### Development without Caddy (Option 2)

```
Browser → http://localhost:8001 (Next.js)
Browser → http://localhost:8002/api/* (NestJS)
```

⚠️ **This option no longer works:**
- Frontend makes relative API calls (e.g., `/api/rest/publicationsinf`) which resolve to `localhost:8001/api/...` → 404 errors
- CORS has been removed from NestJS (not needed when using Caddy)
- **Always use Caddy for local development (Option 1)**

### Production Mode (Caddy + Docker)

```
Browser → Caddy (port 80/443)
         ↓
         ├→ /api/* → api:8002 (NestJS container)
         └→ /* → web:8001 (Next.js container)
```

In production, Caddy routes requests, so CORS is not needed (same origin).

## Testing

### Backend Tests
```bash
cd api
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:e2e           # E2E tests
```

### Frontend Tests
```bash
cd web
npm test                    # Run all tests
npm run test:watch         # Watch mode
```

## Common Issues

### API 404 Errors

If you see 404 errors for API calls:
1. Make sure you're accessing the app through Caddy at `http://localhost:8080` (not `http://localhost:8001`)
2. Verify Caddy is running: `caddy run --config Caddyfile.local`
3. Check that backend is running on port 8002 and frontend on port 8001

### Port Already in Use

If ports 8001, 8002, or 8080 are already in use:
```bash
# Find and kill the process
lsof -ti:8001 | xargs kill -9
lsof -ti:8002 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

### MongoDB Connection Errors

Make sure MongoDB is running:
```bash
# Check if MongoDB is running
pgrep mongod

# Start MongoDB (varies by OS)
sudo systemctl start mongod  # Linux
brew services start mongodb  # macOS
```

## Production Deployment

For production deployment using Docker:

```bash
# Build and start all services (including Caddy)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access via: `http://localhost` (Caddy on port 80)

## Environment Variables Reference

### Backend (`api/.env`)
- `MONGO_URL` - MongoDB connection string
- `BOT_TOKEN` - Telegram bot token (from @BotFather)
- `BOT_USERNAME` - Telegram bot username
- `APP_URL` - Application URL for bot messages
- `S3_*` - S3 credentials (optional, for avatar caching)

### Frontend (`web/.env`)
- `MONGO_URL` - MongoDB connection string (for SSR)
- `BOT_TOKEN` - Telegram bot token (server-side only)
- `NEXT_PUBLIC_BOT_USERNAME` - Bot username (client-accessible)
- `JWT_SECRET` - Secret for JWT tokens
- `APP_URL` - Application URL

## Architecture Changes

This setup implements direct Caddy routing, removing Next.js as a proxy layer:

**Before:**
```
Browser → Next.js (API routes proxy) → NestJS Backend
```

**After (Production):**
```
Browser → Caddy → NestJS Backend (direct for /api/*)
        → Caddy → Next.js Frontend (everything else)
```

**After (Development - Option 1 with Caddy):**
```
Browser → Caddy (localhost:8080) → localhost:8002 (NestJS for /api/*)
        → Caddy (localhost:8080) → localhost:8001 (Next.js for /*)
```

**After (Development - Option 2 without Caddy):**
```
Browser → localhost:8001 (Next.js)
Browser → localhost:8002 (NestJS) ⚠️ NO LONGER SUPPORTED (404 + CORS removed)
```

---

## Quick Start Commands

### With Caddy (Recommended)
```bash
# Terminal 1
cd api && npm run dev

# Terminal 2  
cd web && npm run dev

# Terminal 3
caddy run --config Caddyfile.local

# Access: http://localhost:8080
```

### With Docker Compose (Production-like)
```bash
docker-compose up

# Access: http://localhost
```

