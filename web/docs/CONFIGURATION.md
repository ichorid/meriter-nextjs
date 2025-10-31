# Configuration System

This document describes the centralized configuration system used in the Meriter web frontend application.

## Overview

The configuration system provides:
- **Type-safe access** to all configuration values
- **Environment variable validation** with sensible defaults
- **Centralized configuration** management
- **Feature flags** for enabling/disabling features
- **Development vs production** environment handling

## Configuration Structure

The configuration is organized into logical sections:

### Application Configuration (`config.app`)
- Environment detection (`isDevelopment`, `isProduction`, `isTest`)
- Application URL
- Environment name

### API Configuration (`config.api`)
- Base API URL
- Endpoint paths for different services
- Request/response handling

### Telegram Configuration (`config.telegram`)
- Bot username and token
- Telegram API URL
- Avatar base URL

### S3 Configuration (`config.s3`)
- S3 credentials and settings
- Storage endpoint and region
- Feature enablement

### Feature Flags (`config.features`)
- Analytics enablement
- Debug mode
- Development features

### Messages (`config.messages`)
- Localized message templates
- Bot responses and notifications

## Usage

### In React Components

```tsx
import { useConfig } from '@/hooks/useConfig';

function MyComponent() {
  const { api, telegram, features } = useConfig();
  
  return (
    <div>
      <p>API URL: {api.baseUrl}</p>
      <p>Bot: {telegram.botUsername}</p>
      {features.debug && <DebugPanel />}
    </div>
  );
}
```

### In Utility Functions

```tsx
import { config } from '@/config';

export function buildApiUrl(endpoint: string) {
  return `${config.api.baseUrl}${endpoint}`;
}
```

### Using Specific Configuration Sections

```tsx
import { useApiConfig, useTelegramConfig } from '@/hooks/useConfig';

function ApiComponent() {
  const apiConfig = useApiConfig();
  const telegramConfig = useTelegramConfig();
  
  // Use specific configuration sections
}
```

## Environment Variables

### Required Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_BOT_USERNAME` - Telegram bot username

### Optional Variables

- `NODE_ENV` - Environment (development, production, test)
- `APP_URL` - Application URL
- `BOT_TOKEN` - Telegram bot token
- `NEXT_PUBLIC_TELEGRAM_API_URL` - Telegram API URL
- `NEXT_PUBLIC_S3_ENABLED` - Enable S3 features
- `S3_ACCESS_KEY_ID` - S3 access key
- `S3_SECRET_ACCESS_KEY` - S3 secret key
- `S3_ENDPOINT` - S3 endpoint URL
- `S3_REGION` - S3 region
- `NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL` - Avatar CDN URL
- `NEXT_PUBLIC_ENABLE_ANALYTICS` - Enable analytics
- `NEXT_PUBLIC_ENABLE_DEBUG` - Enable debug mode

## Validation

The configuration system validates all environment variables using Zod schemas:

- **Type validation** - Ensures correct data types
- **Required field validation** - Checks for required variables
- **Default values** - Provides sensible defaults
- **Environment-specific validation** - Validates production settings

## Development vs Production

### Development
- Debug mode enabled by default
- Localhost URLs allowed
- Development features enabled
- React Query DevTools enabled

### Production
- Debug mode disabled
- Localhost URLs not allowed
- Production optimizations enabled
- Analytics can be enabled

## Feature Flags

Feature flags allow you to enable/disable features without code changes:

```tsx
import { useFeaturesConfig } from '@/hooks/useConfig';

function MyComponent() {
  const { analytics, debug } = useFeaturesConfig();
  
  return (
    <div>
      {analytics && <Analytics />}
      {debug && <DebugInfo />}
    </div>
  );
}
```

## Migration from Legacy Configuration

The old configuration system in `config/meriter.ts` is still supported for backward compatibility:

```tsx
// Old way (still works)
import { BOT_USERNAME } from '@config/meriter';

// New way (recommended)
import { useTelegramConfig } from '@/hooks/useConfig';
const { botUsername } = useTelegramConfig();
```

## Validation Script

Run the validation script to check your configuration:

```bash
pnpm validate-config
```

This will:
- Validate all environment variables
- Check for required configuration
- Display current configuration
- Show warnings for missing optional configuration

## Best Practices

1. **Use the centralized config** instead of direct `process.env` access
2. **Use hooks in React components** for better TypeScript support
3. **Use feature flags** for conditional features
4. **Validate configuration** before deployment
5. **Use environment-specific defaults** for different environments

## Troubleshooting

### Common Issues

1. **Missing environment variables** - Check the validation script output
2. **Type errors** - Ensure you're using the correct configuration types
3. **Build failures** - Validate configuration before building
4. **Runtime errors** - Check that all required variables are set

### Debug Mode

Enable debug mode to see additional logging:

```bash
NEXT_PUBLIC_ENABLE_DEBUG=true pnpm dev
```

This will show:
- Configuration validation results
- API request/response details
- Feature flag states
- Environment detection results
