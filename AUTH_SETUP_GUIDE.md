# Authentication Setup Guide

## Problem Summary

You're seeing:
- `authnEnabled: false`
- `enabledProviders: []` (empty array)
- Error: "Unable to transform response from server"

This happens because:
1. **Backend environment variables** are not set to enable OAuth providers
2. **tRPC endpoint** might not be accessible (causing the transformation error)

## Solution

### Step 1: Set Backend Environment Variables

The OAuth providers are configured in the **backend** `.env` file (in the `api/` directory or root directory).

**For each OAuth provider you want to enable**, add these variables to your backend `.env`:

```bash
# Enable the provider
OAUTH_GOOGLE_ENABLED=true
# Or for other providers:
# OAUTH_YANDEX_ENABLED=true
# OAUTH_VK_ENABLED=true
# OAUTH_TELEGRAM_ENABLED=true
# OAUTH_APPLE_ENABLED=true
# OAUTH_TWITTER_ENABLED=true
# OAUTH_INSTAGRAM_ENABLED=true
# OAUTH_SBER_ENABLED=true
# OAUTH_MAILRU_ENABLED=true

# Provider credentials (required when enabled)
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:8001/api/v1/auth/google/callback
# Or use OAUTH_GOOGLE_REDIRECT_URI instead of CALLBACK_URL
```

### Step 2: Enable WebAuthn/Passkeys (Optional)

To enable passkey authentication:

```bash
AUTHN_ENABLED=true
```

### Step 3: Available OAuth Providers

The following OAuth providers are supported:

- **Google** (`OAUTH_GOOGLE_*`)
- **Yandex** (`OAUTH_YANDEX_*`)
- **VK** (`OAUTH_VK_*`)
- **Telegram** (`OAUTH_TELEGRAM_*`)
- **Apple** (`OAUTH_APPLE_*`)
- **Twitter** (`OAUTH_TWITTER_*`)
- **Instagram** (`OAUTH_INSTAGRAM_*`)
- **Sber** (`OAUTH_SBER_*`)
- **Mail.ru** (`OAUTH_MAILRU_*`)

### Step 4: Example Configuration

Here's a minimal example to enable Google OAuth:

```bash
# In your backend .env file (api/.env or root .env)

# Enable Google OAuth
OAUTH_GOOGLE_ENABLED=true

# Google OAuth credentials
OAUTH_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=your-client-secret
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:8001/api/v1/auth/google/callback

# Enable WebAuthn (optional)
AUTHN_ENABLED=true
```

### Step 5: Restart Backend API Server

After updating the `.env` file, **restart your backend API server** so it picks up the new environment variables.

```bash
# If using Docker Compose
docker-compose restart api

# If running directly
# Stop and restart your NestJS server
```

### Step 6: Verify Setup

1. **Check backend logs** - The backend should log which OAuth providers are configured on startup
2. **Check browser console** - After restart, the login page should show enabled providers
3. **Check tRPC endpoint** - The frontend fetches config via `/trpc/config.getConfig`

## Troubleshooting

### Error: "Unable to transform response from server"

This error means the tRPC endpoint (`/trpc/config.getConfig`) is not accessible or returned an invalid response.

**Check:**

1. **Is the backend API running?**
   ```bash
   # Check if API server is running on port 8002
   curl http://localhost:8002/trpc/config.getConfig
   ```

2. **Is Caddy configured correctly?**
   - Make sure Caddy is running
   - Check that `/trpc*` routes are proxied to the backend API
   - See `Caddyfile.local` or `Caddyfile` for configuration

3. **Check browser Network tab**
   - Look for the request to `/trpc/config.getConfig`
   - Check if it returns 200 OK or an error
   - Check the response format (should be JSON, not HTML)

4. **Verify tRPC endpoint**
   ```bash
   # Direct API call (should return config JSON)
   curl http://localhost:8002/trpc/config.getConfig
   ```

### No Providers Showing Up

If `enabledProviders` is still empty after setting environment variables:

1. **Verify environment variables are set correctly**
   ```bash
   # In your backend directory, check if variables are loaded
   # The backend reads from process.env at startup
   ```

2. **Check backend startup logs**
   - The backend logs OAuth configuration status on startup
   - Look for messages like "✅ Google OAuth configured" or warnings

3. **Verify the tRPC config endpoint returns the providers**
   ```bash
   curl http://localhost:8002/trpc/config.getConfig
   # Should return JSON with oauth object containing enabled providers
   ```

4. **Check browser console**
   - The login page logs `enabledProviders` to console
   - Check what values are being logged

## Environment Variable Reference

### Backend Variables (Required in `api/.env` or root `.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `OAUTH_*_ENABLED` | Enable a specific OAuth provider | `true` or `false` |
| `OAUTH_*_CLIENT_ID` | OAuth client ID | Provider-specific |
| `OAUTH_*_CLIENT_SECRET` | OAuth client secret | Provider-specific |
| `OAUTH_*_CALLBACK_URL` | OAuth callback URL | `http://localhost:8001/api/v1/auth/{provider}/callback` |
| `AUTHN_ENABLED` | Enable WebAuthn/Passkeys | `true` or `false` |

### Frontend Variables (Optional, in `web/.env`)

These are only used as **build-time fallbacks** if the runtime config API fails:

```bash
# Build-time fallbacks (optional)
NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=true
NEXT_PUBLIC_AUTHN_ENABLED=true
```

**Note:** The frontend prefers runtime config from the backend API over build-time variables.

## Architecture

1. **Backend** reads environment variables at startup
2. **Backend tRPC endpoint** (`/trpc/config.getConfig`) returns enabled providers
3. **Frontend** fetches config via `useRuntimeConfig()` hook
4. **Frontend** displays enabled providers on the login page

The runtime config approach allows enabling/disabling providers without rebuilding the frontend.





