# Telegram Web App Integration

This document describes how Meriter integrates with Telegram as a Web App, providing seamless authentication and native-like experience when opened from Telegram.

## Overview

Meriter supports dual operation modes:
1. **Standard Web Mode**: Works as a regular website with Telegram Login Widget
2. **Telegram Web App Mode**: Automatically authenticates users when opened from Telegram's internal browser

## Features

### Auto-Detection & Authentication
- Automatically detects when opened in Telegram Web App
- Uses `initData` for secure authentication without requiring login widget
- Falls back to standard Telegram Widget when opened in regular browser
- Maintains session via HTTP-only cookies

### Theme Synchronization
- Automatically uses Telegram's light/dark theme
- Responds to theme changes in real-time
- Maintains theme consistency with Telegram UI

### Haptic Feedback
- Provides tactile feedback on voting actions
- Different feedback types for success, error, and warning states

## Configuration

### Bot Setup

#### 1. Configure Web App URL

In @BotFather, set your bot's Web App URL:
```
/setmenubutton
<select your bot>
Web App
https://meriter.pro/meriter/login
```

#### 2. Configure Bot Domain (Important!)

**If you see "bot domain invalid" error**, you need to configure the bot's domain in @BotFather:

```
/setdomain
<select your bot>
meriter.pro
```

**Important**: The domain must match exactly the domain you're using (without `https://` prefix). 
- ✅ Correct: `meriter.pro`
- ❌ Wrong: `https://meriter.pro`
- ❌ Wrong: `www.meriter.pro` (if you're using the non-www version)

#### 3. Environment Variables

Ensure these are set in your `.env`:

```bash
# Bot token for authentication validation
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Bot username (without @)
BOT_USERNAME=meriterbot

# App URL
APP_URL=https://meriter.pro
```

## Implementation Details

### Frontend Components

#### `useTelegramWebApp` Hook
Location: `web/src/shared/hooks/useTelegramWebApp.ts`

Provides access to Telegram Web App API:
```typescript
const { 
  isInTelegram,    // boolean: true if in Telegram
  initData,        // string: authentication data
  user,            // object: user info from Telegram
  webApp,          // object: full Telegram WebApp API
  hapticFeedback,  // object: haptic feedback methods
  colorScheme,     // 'light' | 'dark'
} = useTelegramWebApp();
```

#### Modified Components

1. **Login Page** (`web/src/app/meriter/login/page.tsx`)
   - Auto-detects Telegram Web App mode
   - Calls `/api/rest/telegram-auth/webapp` endpoint
   - Falls back to widget if not in Telegram

2. **Theme Provider** (`web/src/shared/lib/theme-provider.tsx`)
   - Syncs with Telegram theme
   - Listens for theme change events

### Backend Endpoints

#### POST `/api/rest/telegram-auth/webapp`
Location: `api/apps/meriter/src/rest-api/rest/telegram-auth/telegram-auth.controller.ts`

Validates Telegram Web App `initData` and creates session.

**Request Body:**
```json
{
  "initData": "query_id=...&user=...&auth_date=...&hash=..."
}
```

**Response:**
```json
{
  "success": true,
  "hasPendingCommunities": false,
  "user": {
    "tgUserId": "123456789",
    "name": "John Doe",
    "token": "user_token_here",
    "chatsIds": ["-100123456"]
  }
}
```

**Validation Process:**
1. Parse `initData` query string
2. Extract and verify hash using HMAC-SHA256
3. Use "WebAppData" constant (per Telegram docs)
4. Check auth_date within 24 hours
5. Parse and validate user data
6. Create/update user session
7. Discover user communities
8. Return session JWT in HTTP-only cookie

## Usage Examples

### Checking if in Telegram Web App
```typescript
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';

function MyComponent() {
  const { isInTelegram } = useTelegramWebApp();
  
  if (isInTelegram) {
    // Show Telegram-specific UI
  } else {
    // Show regular web UI
  }
}
```

### Adding Haptic Feedback
```typescript
const { hapticFeedback } = useTelegramWebApp();

const handleClick = () => {
  hapticFeedback?.impact('light');  // 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
  // Your logic here
};

const handleSuccess = () => {
  hapticFeedback?.notification('success');  // 'success' | 'error' | 'warning'
};
```

### Using Main Button
```typescript
const { webApp, isInTelegram } = useTelegramWebApp();

useEffect(() => {
  if (isInTelegram && webApp) {
    webApp.MainButton.setText('Submit');
    webApp.MainButton.show();
    webApp.MainButton.onClick(handleSubmit);
    
    return () => {
      webApp.MainButton.hide();
      webApp.MainButton.offClick(handleSubmit);
    };
  }
}, [isInTelegram, webApp, handleSubmit]);
```

### Setting Colors
```typescript
const { webApp } = useTelegramWebApp();

useEffect(() => {
  if (webApp?.themeParams) {
    const bgColor = webApp.themeParams.bg_color || '#ffffff';
    webApp.setHeaderColor(bgColor);
    webApp.setBackgroundColor(bgColor);
  }
}, [webApp]);
```

## Differences Between Modes

| Feature | Web Mode | Telegram Web App Mode |
|---------|----------|----------------------|
| Authentication | Telegram Widget | Automatic via initData |
| Theme | Manual selection | Auto from Telegram |
| Haptic Feedback | None | Yes |
| Main Button | Regular HTML button | Telegram Main Button |
| Back Button | Browser back | Telegram Back Button |
| Colors | DaisyUI theme | Telegram theme colors |

## Security

### Authentication Flow

1. **Widget Mode**: Hash validated using bot token with SHA-256
2. **Web App Mode**: Hash validated using bot token with HMAC-SHA256 and "WebAppData" constant

Both modes:
- Use HTTP-only cookies for session
- Validate within 24-hour window
- Generate JWT with user claims
- Store session server-side

### Best Practices

- Never expose `initData` to logs
- Always validate hash server-side
- Use secure cookies in production
- Implement rate limiting on auth endpoints
- Validate auth_date timestamp

## Troubleshooting

### "Invalid Web App data" Error
- Check TELEGRAM_BOT_TOKEN is correctly set
- Verify initData hasn't expired (24h limit)
- Ensure bot token matches the bot opening the app

### "Bot domain invalid" Error
- This error appears when the bot's domain is not configured correctly in @BotFather
- **Solution**: Run `/setdomain` command in @BotFather with your exact domain (e.g., `meriter.pro`)
- The domain must match exactly - no `https://`, no `www` if your site doesn't use it
- After setting the domain, restart the Telegram app or wait a few minutes for changes to propagate

### Theme Not Syncing
- Check Telegram Web App script is loaded
- Verify `window.Telegram.WebApp` is available
- Look for console errors

### Authentication Loop
- Clear cookies and try again
- Check network tab for auth endpoint responses
- Verify JWT is being set in cookie

## Resources

- [Telegram Web Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Next.js Documentation](https://nextjs.org/docs)
- [@BotFather](https://t.me/botfather) - Bot configuration