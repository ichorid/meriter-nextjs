# Telegram Web App Deep Link Integration

This document describes the implementation of Telegram Web App deep link integration for the Meriter application.

## Overview

The bot messages now use Telegram Web App URLs instead of regular website URLs, providing a seamless user experience within the Telegram ecosystem.

## URL Format

Telegram Web App URLs follow this pattern:
```
https://t.me/{bot_username}?startapp={action}&{params}
```

### Examples:
- Login: `https://t.me/meriter_pro_bot?startapp=login`
- Publication: `https://t.me/meriter_pro_bot?startapp=publication&id=123`
- Community: `https://t.me/meriter_pro_bot?startapp=community&id=456`
- Global Feed: `https://t.me/meriter_pro_bot?startapp=global-feed`
- Setup: `https://t.me/meriter_pro_bot?startapp=setup`
- Poll: `https://t.me/meriter_pro_bot?startapp=poll&id=789`
- Updates: `https://t.me/meriter_pro_bot?startapp=updates`

## Implementation Details

### 1. Bot Message Templates Updated

All bot message templates in both `api/apps/meriter/src/config.ts` and `web/config/meriter.ts` have been updated to use Telegram Web App URLs:

- `WELCOME_USER_MESSAGE`
- `AUTH_USER_MESSAGE`
- `ADDED_PUBLICATION_REPLY`
- `GLOBAL_FEED_INCOMMING_FROM_COMMUNITY`
- `ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY`
- `LEADER_MESSAGE_AFTER_ADDED`
- `WELCOME_COMMUNITY_TEXT1`
- `WELCOME_COMMUNITY_TEXT`

### 2. Notification Messages Updated

Real-time notifications sent by the bot now use Telegram Mini App URLs:

- **Poll Creation Notifications**: When a poll is created, the bot sends a notification with a direct link to the poll in the Mini App
- **Publication Reply Messages**: When publications are created from group messages, reply messages use Mini App URLs
- **Update Notifications**: User update notifications (from UpdatesConductorsService) now use Mini App URLs

### 3. Deep Link Handler

A new utility `useDeepLinkHandler` hook has been created in `web/src/shared/lib/deep-link-handler.ts` that:

- Extracts `startapp` and `id` parameters from URL
- Handles navigation based on the action type
- **Supports complex publication paths** like `communities/chatId/posts/slug`
- Provides fallback navigation logic
- Supports pending communities detection

### 4. Updated Pages

#### Login Page (`web/src/app/meriter/login/page.tsx`)
- Added deep link parameter extraction
- Integrated deep link handler for post-authentication navigation
- Maintains backward compatibility with `returnTo` parameter

#### Setup Community Page (`web/src/app/meriter/setup-community/page.tsx`)
- Added deep link parameter extraction
- Integrated deep link handler for post-authentication navigation
- Handles both authenticated and unauthenticated users

#### Community Page (`web/src/app/meriter/communities/[id]/page.tsx`)
- **Added support for `post` query parameter** for deep linking to specific posts
- **Automatic scrolling and highlighting** of target posts
- **Visual highlighting** with ring and background color for 3 seconds
- Smooth scroll behavior to center the target post

## Deep Link Actions

| Action | Description | Parameters | Redirect Path |
|--------|-------------|------------|---------------|
| `login` | User login flow | None | `/meriter/home` or based on pending communities |
| `publication` | View specific publication | `id` (simple ID or `communities/chatId/posts/slug`) | `/meriter/publications/{id}` or `/meriter/communities/{chatId}?post={slug}` |
| `community` | View specific community | `id` | `/meriter/communities/{id}` |
| `global-feed` | Global merit feed | None | `/meriter/merit` |
| `setup` | Community setup | None | `/meriter/setup-community` |
| `poll` | View specific poll | `id` | `/meriter/polls/{id}` |
| `updates` | User updates/notifications | None | `/meriter/home?updates=true` |

## Benefits

1. **Seamless Authentication**: Users don't need to log in again since they're already authenticated in Telegram
2. **Better UX**: The app opens directly within Telegram, providing a native experience
3. **No Browser Redirects**: Users stay within the Telegram ecosystem
4. **Automatic User Context**: Telegram Web App provides user data automatically
5. **Deep Linking**: Direct navigation to specific content based on bot message context

## Testing

To test the implementation:

1. Send a message with hashtags to a bot-enabled group
2. Click on the generated Telegram Web App link
3. Verify that the app opens within Telegram
4. Confirm that authentication happens automatically
5. Check that navigation goes to the correct page based on the `startapp` parameter

## Configuration

Make sure your bot is configured with BotFather:
1. Go to [@BotFather](https://t.me/BotFather)
2. Send `/mybots` and select your bot
3. Choose "Bot Settings" → "Configure Mini App" → "Enable Mini App"
4. Provide your web app URL (e.g., `https://meriter.pro`)
5. Set a short name for your Mini App (e.g., `meriter`)
