# Local Development Setup for Telegram Web Auth

This guide explains the proper way to run Meriter for local development with Telegram Web App authentication.

## Quick Start

The **easiest way** to run the project locally is using **Docker Compose**, which handles everything including MongoDB:

```bash
# 1. Create .env file from template
cp env.example .env

# 2. Edit .env and set your bot credentials
# REQUIRED: BOT_TOKEN and BOT_USERNAME
nano .env  # or use your preferred editor

# 3. Start all services (MongoDB, API, Web, Caddy)
docker compose -f docker-compose.local.yml up -d --build

# 4. View logs
docker compose -f docker-compose.local.yml logs -f

# 5. Access the application
# Open in browser: http://localhost:8001
# Or via Caddy: http://localhost (port 80)
```

That's it! All services run in containers, including MongoDB.

## Manual Setup (Without Docker)

If you prefer to run services manually:

### Prerequisites

- Node.js v18+
- MongoDB running locally on `mongodb://127.0.0.1:27017`
- pnpm (or npm)
- Caddy (optional, but **highly recommended**)

### Step-by-Step Setup

#### 1. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

#### 2. Configure Environment Variables

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
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
```

#### 3. Install Caddy (Recommended)

Caddy is a reverse proxy that routes requests correctly and avoids CORS issues.

```bash
# Debian/Ubuntu
sudo apt install caddy

# macOS
brew install caddy

# Other platforms: https://caddyserver.com/docs/install
```

#### 4. Start Services

**With Caddy (Recommended - Production Parity):**

Open **three** terminal windows:

**Terminal 1 - Backend (NestJS):**
```bash
pnpm --filter @meriter/api dev
```
- Runs on `http://localhost:8002`

**Terminal 2 - Frontend (Next.js):**
```bash
pnpm --filter @meriter/web dev
```
- Runs on `http://localhost:8001`

**Terminal 3 - Caddy:**
```bash
caddy run --config Caddyfile.local
```
- Runs on `http://localhost:8080`
- Routes `/api/*` to backend (8002)
- Routes everything else to frontend (8001)

**Access:** `http://localhost:8080`

✅ All API calls work correctly  
✅ No CORS issues  
✅ Matches production behavior  

---

**Without Caddy (Not Recommended):**

⚠️ **Known Issues:**
- API calls will fail with 404 errors
- CORS errors
- Does not match production behavior

This option is **not recommended** and only documented for reference. Always use Caddy for local development.

---

## Testing Telegram Web App Authentication

Meriter supports **two authentication modes**:

### 1. Regular Browser Mode (Development)

When opened in a regular browser (Chrome, Firefox, Safari), you'll see the **Telegram Login Widget**:

1. Open `http://localhost:8080/meriter/login` in your browser
2. Click the Telegram Login Widget button
3. Complete Telegram authentication
4. Get redirected to the app

### 2. Telegram Web App Mode (Production)

When opened from within Telegram (bot menu or Web App link), authentication is **automatic**:

1. Open the app from Telegram
2. Authentication happens automatically with `initData`
3. No manual interaction required

### 3. Mock Mode (Testing Web App Features Locally)

To test Telegram Web App features in a regular browser during development:

1. Add `?mock-telegram=true` to any URL
2. Example: `http://localhost:8080/meriter/login?mock-telegram=true`
3. The app will simulate Telegram Web App environment

**Mock Mode Features:**
- Simulates `initData` for testing Web App auth flow
- Enables Telegram UI components (BackButton, MainButton, etc.)
- Provides mock theme parameters
- Shows console messages about mock status

**Note:** Mock mode authentication will fail (invalid mock data), but you can test the UI flow.

---

## Configuration Details

### Why Caddy is Required

The application uses **direct Caddy routing** in production:
- Caddy routes `/api/*` requests to NestJS backend
- Caddy routes everything else to Next.js frontend
- No CORS needed (same origin through Caddy)

For local development, using Caddy ensures:
- Production parity
- No CORS issues
- Correct API routing

### Port Mapping

| Service | Port | Description |
|---------|------|-------------|
| Caddy (Dev) | 8080 | Reverse proxy (development) |
| Caddy (Docker) | 80 | Reverse proxy (production) |
| Next.js Frontend | 8001 | Web application |
| NestJS Backend | 8002 | API server |
| MongoDB | 27017 | Database |

### Environment Variables

**Key Variables:**

- `BOT_TOKEN` (REQUIRED): Telegram bot token from @BotFather
- `BOT_USERNAME` (REQUIRED): Telegram bot username without @
- `MONGO_URL`: MongoDB connection string
- `NEXT_PUBLIC_API_URL`: API URL for frontend (use `http://localhost:8080/api` with Caddy)
- `NEXT_PUBLIC_BOT_USERNAME`: Bot username for frontend
- `JWT_SECRET`: Secret for JWT tokens (API only, optional for dev)

---

## Docker Compose Services

The `docker-compose.local.yml` includes:

- **mongodb**: MongoDB database (persistent data)
- **web**: Next.js frontend container
- **api**: NestJS backend container
- **caddy**: Reverse proxy container

All services communicate through Docker network, isolated from your host machine.

---

## Troubleshooting

### API 404 Errors

**Symptom:** API calls return 404 errors

**Solutions:**
1. Make sure you're accessing through Caddy at `http://localhost:8080` (not `http://localhost:8001`)
2. Verify Caddy is running: `caddy run --config Caddyfile.local`
3. Check that backend is running on port 8002
4. Check that `NEXT_PUBLIC_API_URL=http://localhost:8080/api` in `web/.env`

### Authentication Not Working

**Symptom:** Can't authenticate with Telegram

**Solutions:**
1. Verify `BOT_TOKEN` and `BOT_USERNAME` are correct in `.env` files
2. Check console for error messages
3. Make sure MongoDB is running and accessible
4. Try clearing browser cookies

### Port Already in Use

**Symptom:** Services fail to start due to port conflicts

**Solutions:**
```bash
# Find and kill processes using the ports
lsof -ti:8001 | xargs kill -9
lsof -ti:8002 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

### MongoDB Connection Errors

**With Docker:**
```bash
# Check MongoDB container logs
docker compose -f docker-compose.local.yml logs mongodb

# Restart MongoDB
docker compose -f docker-compose.local.yml restart mongodb
```

**Without Docker:**
```bash
# Check if MongoDB is running
pgrep mongod

# Start MongoDB (varies by OS)
sudo systemctl start mongod  # Linux
brew services start mongodb  # macOS
```

---

## Development Workflow

### Hot Reload

Both Next.js and NestJS support hot reload in development mode:

- **Frontend**: Edit files in `web/src/`, changes appear immediately
- **Backend**: Edit files in `api/apps/meriter/src/`, server restarts automatically

### Viewing Logs

**With Docker:**
```bash
# All services
docker compose -f docker-compose.local.yml logs -f

# Specific service
docker compose -f docker-compose.local.yml logs -f web
docker compose -f docker-compose.local.yml logs -f api
```

**Without Docker:**
- Frontend: logs in terminal where `pnpm --filter @meriter/web dev` is running
- Backend: logs in terminal where `pnpm --filter @meriter/api dev` is running
- Caddy: logs to stdout

### Stopping Services

**With Docker:**
```bash
# Stop all services
docker compose -f docker-compose.local.yml down

# Stop and remove volumes (clears database)
docker compose -f docker-compose.local.yml down -v
```

**Without Docker:**
- Press `Ctrl+C` in each terminal window

---

## Architecture Overview

### Production Architecture

```
Browser → Caddy (port 80/443)
         ↓
         ├→ /api/* → api:8002 (NestJS container)
         └→ /* → web:8001 (Next.js container)
```

### Development Architecture (With Caddy)

```
Browser → Caddy (localhost:8080)
         ↓
         ├→ /api/* → localhost:8002 (NestJS)
         └→ /* → localhost:8001 (Next.js)
```

### Development Architecture (Docker Compose)

```
Browser → Caddy (localhost:80)
         ↓
         ├→ /api/* → api:8002 (NestJS container)
         └→ /* → web:8001 (Next.js container)
         ↓
         MongoDB (internal network only)
```

---

## Next Steps

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for more detailed information
2. Check [web/TELEGRAM_WEBAPP.md](web/TELEGRAM_WEBAPP.md) for Telegram integration details
3. Review [API documentation](api/apps/meriter/docs/) for backend API
4. Explore the codebase structure

---

## Quick Reference

### Docker Commands

```bash
# Start everything
docker compose -f docker-compose.local.yml up -d --build

# Stop everything
docker compose -f docker-compose.local.yml down

# View logs
docker compose -f docker-compose.local.yml logs -f

# Rebuild after code changes
docker compose -f docker-compose.local.yml up -d --build

# Clean rebuild (removes volumes)
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d --build
```

### Manual Commands

```bash
# Install dependencies
pnpm install

# Start backend
pnpm --filter @meriter/api dev

# Start frontend
pnpm --filter @meriter/web dev

# Start Caddy
caddy run --config Caddyfile.local

# Or use convenience scripts
pnpm dev:api   # Start API
pnpm dev:web   # Start Web
```

---

## Getting Help

- Check the console logs for error messages
- Review the documentation files
- Inspect network requests in browser DevTools
- Check service logs for detailed error information

---

**Happy Coding! 🚀**

