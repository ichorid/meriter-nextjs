# OAuth Providers and Authorization Strategies Guide

## Overview

The project supports 8 OAuth providers for user authorization. All providers work according to a unified logic, tested on the Google OAuth example.

## Supported Providers

1. **Google** ✅ (implemented)
2. **Yandex** (ready for implementation)
3. **VK** (ready for implementation)
4. **Telegram** (ready for implementation)
5. **Apple** (ready for implementation)
6. **Twitter** (ready for implementation)
7. **Instagram** (ready for implementation)
8. **Sber** (ready for implementation)

## Environment Variables for .env

### Google OAuth (lines 86-91 in docker-compose.local.yml)

```env
# Google OAuth - required variables
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GOOGLE_REDIRECT_URI=http://localhost:8002/api/v1/auth/google/callback
# or alternative name
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:8002/api/v1/auth/google/callback

# Optional variables
OAUTH_GOOGLE_ENABLED=true  # Explicit enable (true/false/not set)
GOOGLE_REDIRECT_URI=http://localhost:8002/api/v1/auth/google/callback  # Backward compatibility
```

**Strategy**: `GoogleStrategy` in `api/apps/meriter/src/api-v1/auth/strategies/google.strategy.ts`  
**Endpoint**: `GET /api/v1/auth/google`  
**Callback**: `GET /api/v1/auth/google/callback` or `GET /api/v1/auth/oauth/google/callback`  
**Lucide Icon**: `Chrome`

---

### Yandex OAuth (lines 127-130 in docker-compose.local.yml)

```env
# Yandex OAuth - required variables
OAUTH_YANDEX_CLIENT_ID=your_yandex_client_id
OAUTH_YANDEX_CLIENT_SECRET=your_yandex_client_secret
OAUTH_YANDEX_CALLBACK_URL=http://localhost:8002/api/v1/auth/yandex/callback

# Optional variables
OAUTH_YANDEX_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `YandexStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/yandex`  
**Callback**: `GET /api/v1/auth/yandex/callback`  
**Lucide Icon**: `Search`

---

### VK OAuth (lines 122-125 in docker-compose.local.yml)

```env
# VK OAuth - required variables
OAUTH_VK_CLIENT_ID=your_vk_application_id
OAUTH_VK_CLIENT_SECRET=your_vk_secure_key
OAUTH_VK_CALLBACK_URL=http://localhost:8002/api/v1/auth/vk/callback

# Optional variables
OAUTH_VK_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `VkStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/vk`  
**Callback**: `GET /api/v1/auth/vk/callback`  
**Lucide Icon**: `Users`

---

### Telegram OAuth (lines 113-115 in docker-compose.local.yml)

```env
# Telegram OAuth - required variables
OAUTH_TELEGRAM_BOT_USERNAME=your_bot_username
OAUTH_TELEGRAM_CALLBACK_URL=http://localhost:8002/api/v1/auth/telegram/callback

# Optional variables
OAUTH_TELEGRAM_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `TelegramStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/telegram`  
**Callback**: `GET /api/v1/auth/telegram/callback`  
**Lucide Icon**: `Send`  
**Features**: Uses Telegram Login Widget, requires bot setup via BotFather

---

### Apple OAuth (lines 98-103 in docker-compose.local.yml)

```env
# Apple OAuth - required variables
OAUTH_APPLE_CLIENT_ID=your_apple_service_id
OAUTH_APPLE_KEY_ID=your_apple_key_id
OAUTH_APPLE_TEAM_ID=your_apple_team_id
OAUTH_APPLE_PRIVATE_KEY=your_apple_private_key_pem_format
OAUTH_APPLE_CALLBACK_URL=http://localhost:8002/api/v1/auth/apple/callback

# Optional variables
OAUTH_APPLE_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `AppleStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/apple`  
**Callback**: `GET /api/v1/auth/apple/callback`  
**Lucide Icon**: `Apple`  
**Features**: Uses JWT for authentication, requires Private Key in PEM format

---

### Twitter OAuth (lines 117-120 in docker-compose.local.yml)

```env
# Twitter OAuth - required variables
OAUTH_TWITTER_CLIENT_ID=your_twitter_client_id
OAUTH_TWITTER_CLIENT_SECRET=your_twitter_client_secret
OAUTH_TWITTER_CALLBACK_URL=http://localhost:8002/api/v1/auth/twitter/callback

# Optional variables
OAUTH_TWITTER_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `TwitterStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/twitter`  
**Callback**: `GET /api/v1/auth/twitter/callback`  
**Lucide Icon**: `Twitter`

---

### Instagram OAuth (lines 93-96 in docker-compose.local.yml)

```env
# Instagram OAuth - required variables
OAUTH_INSTAGRAM_CLIENT_ID=your_instagram_client_id
OAUTH_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
OAUTH_INSTAGRAM_CALLBACK_URL=http://localhost:8002/api/v1/auth/instagram/callback

# Optional variables
OAUTH_INSTAGRAM_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `InstagramStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/instagram`  
**Callback**: `GET /api/v1/auth/instagram/callback`  
**Lucide Icon**: `Instagram`

---

### Sber OAuth (lines 105-111 in docker-compose.local.yml)

```env
# Sber OAuth - required variables
OAUTH_SBER_CLIENT_ID=your_sber_client_id
OAUTH_SBER_CLIENT_SECRET=your_sber_client_secret
OAUTH_SBER_AUTHORIZATION_URL=https://sberid.ru/oauth/authorize
OAUTH_SBER_TOKEN_URL=https://sberid.ru/oauth/token
OAUTH_SBER_USERINFO_URL=https://sberid.ru/api/userinfo
OAUTH_SBER_CALLBACK_URL=http://localhost:8002/api/v1/auth/sber/callback

# Optional variables
OAUTH_SBER_ENABLED=true  # Explicit enable (true/false/not set)
```

**Strategy**: `SberStrategy` (requires creation)  
**Endpoint**: `GET /api/v1/auth/sber`  
**Callback**: `GET /api/v1/auth/sber/callback`  
**Lucide Icon**: `Building2`  
**Features**: Uses custom endpoints, requires configuration of all URL endpoints

---

## `OAUTH_*_ENABLED` Flags Logic

Each provider has an `OAUTH_{PROVIDER}_ENABLED` flag for management:

1. **`OAUTH_*_ENABLED=false` or `0`**: Provider is explicitly disabled, strategy is not registered
2. **`OAUTH_*_ENABLED=true`**: Provider is explicitly enabled, all credentials are required (`CLIENT_ID`, `CLIENT_SECRET`, `CALLBACK_URL`)
3. **`OAUTH_*_ENABLED` not set**: Automatic detection based on credentials presence (if all credentials are present - enabled)

## General Implementation Logic

All providers work according to a unified logic:

### 1. Conditional Strategy Registration (`auth.module.ts`)

```typescript
function get{Provider}Strategy() {
  // Check OAUTH_{PROVIDER}_ENABLED flag
  const enabled = process.env.OAUTH_{PROVIDER}_ENABLED;
  if (enabled === 'false' || enabled === '0') {
    return null; // Explicitly disabled
  }
  
  // Check credentials presence
  const clientID = process.env.OAUTH_{PROVIDER}_CLIENT_ID;
  const clientSecret = process.env.OAUTH_{PROVIDER}_CLIENT_SECRET;
  const callbackURL = process.env.OAUTH_{PROVIDER}_CALLBACK_URL;
  
  // If explicitly enabled - all credentials are required
  if (enabled === 'true' && (!clientID || !clientSecret || !callbackURL)) {
    return null;
  }
  
  // If not explicitly enabled - check credentials presence (auto-detection)
  if (!clientID || !clientSecret || !callbackURL) {
    return null;
  }
  
  // Load strategy
  try {
    const { {Provider}Strategy } = require('./strategies/{provider}.strategy');
    return {Provider}Strategy;
  } catch (e) {
    return null;
  }
}
```

### 2. OAuth Initialization (`auth.controller.ts`)

```typescript
@Get('{provider}')
async {provider}Auth(@Req() req: any, @Res() res: any) {
  // Check OAUTH_{PROVIDER}_ENABLED flag
  const enabled = process.env.OAUTH_{PROVIDER}_ENABLED;
  if (enabled === 'false' || enabled === '0') {
    throw new Error('{Provider} OAuth is disabled');
  }
  
  // Check credentials (clientId and callbackUrl for initialization)
  const clientId = process.env.OAUTH_{PROVIDER}_CLIENT_ID;
  const callbackUrl = process.env.OAUTH_{PROVIDER}_CALLBACK_URL;
  
  if (!clientId || !callbackUrl) {
    throw new Error('{Provider} OAuth not configured');
  }
  
  // Redirect to OAuth provider with state parameter for return_url
  const state = JSON.stringify({ returnTo, return_url: returnTo });
  const oauthUrl = `{PROVIDER_OAUTH_URL}?...&state=${encodeURIComponent(state)}`;
  res.redirect(oauthUrl);
}
```

### 3. Callback Handling (`auth.service.ts`)

All providers use the universal `authenticateWithProvider()` method:

```typescript
async authenticateWithProvider(providerUser: {
  provider: string;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
}) {
  // Create provider-specific ID: {provider}_{providerId}
  const authId = `${providerUser.provider}_${providerUser.providerId}`;
  
  // Find or create user by provider ID
  let user = await this.userService.getUserByTelegramId(authId);
  if (!user) {
    user = await this.userService.createOrUpdateUser({
      telegramId: authId,
      username: providerUser.email?.split('@')[0],
      firstName: providerUser.firstName,
      lastName: providerUser.lastName,
      displayName: providerUser.displayName,
      avatarUrl: providerUser.avatarUrl,
    });
  }
  
  // Generate JWT token
  const jwtToken = signJWT({
    uid: user.id,
    telegramId: authId,
    communityTags: user.communityTags || [],
  }, jwtSecret, '365d');
  
  // Return standardized response
  return {
    user: JwtService.mapUserToV1Format(user),
    hasPendingCommunities: (user.communityTags?.length || 0) > 0,
    jwt: jwtToken,
  };
}
```

## Lucide Icons for UI

All providers use icons from the [Lucide React](https://lucide.dev/guide/packages/lucide-react) library:

| Provider | Lucide Icon | Component |
|----------|-------------|-----------|
| Google | `Chrome` | `<Chrome className="w-5 h-5" />` |
| Yandex | `Search` | `<Search className="w-5 h-5" />` |
| VK | `Users` | `<Users className="w-5 h-5" />` |
| Telegram | `Send` | `<Send className="w-5 h-5" />` |
| Apple | `Apple` | `<Apple className="w-5 h-5" />` |
| Twitter | `Twitter` | `<Twitter className="w-5 h-5" />` |
| Instagram | `Instagram` | `<Instagram className="w-5 h-5" />` |
| Sber | `Building2` | `<Building2 className="w-5 h-5" />` |

## Usage Example in LoginForm

```typescript
import { OAUTH_PROVIDERS, getOAuthUrl } from '@/lib/utils/oauth-providers';
import * as LucideIcons from 'lucide-react';

{OAUTH_PROVIDERS.map((provider) => {
  const IconComponent = LucideIcons[provider.icon];
  return (
    <button
      key={provider.id}
      onClick={() => window.location.href = getOAuthUrl(provider.id)}
    >
      <IconComponent className="w-5 h-5" />
      Sign in with {provider.name}
    </button>
  );
})}
```

## Documentation

- **Lucide Icons**: https://lucide.dev/guide/
- **Lucide React**: https://lucide.dev/guide/packages/lucide-react
- **NestJS Passport**: https://docs.nestjs.com/recipes/passport
- **OAuth 2.0**: https://oauth.net/2/

---

**Creation Date**: 2025-01-16  
**Version**: 1.0

