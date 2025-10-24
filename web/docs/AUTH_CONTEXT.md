# Authentication Context System

This document describes the centralized authentication system implemented in the Meriter web frontend application.

## Overview

The authentication system provides:
- **Centralized authentication state management**
- **Multiple authentication methods** (Telegram widget, Web App)
- **Route protection** with authentication guards
- **Token management** and automatic refresh
- **Deep link handling** for Telegram Web App
- **Error handling** and loading states

## Architecture

### AuthContext (`src/contexts/AuthContext.tsx`)

The main authentication context that provides:
- User state management
- Authentication methods
- Token management
- Error handling

### AuthGuard (`src/components/AuthGuard.tsx`)

Route protection component that:
- Checks authentication status
- Redirects unauthenticated users
- Handles loading states
- Provides error handling

### LoginForm (`src/components/LoginForm.tsx`)

Centralized login component that:
- Handles Telegram widget authentication
- Handles Telegram Web App authentication
- Manages authentication flow
- Provides error feedback

### LogoutButton (`src/components/LogoutButton.tsx`)

Centralized logout component that:
- Handles logout functionality
- Provides confirmation dialogs
- Clears authentication state
- Manages loading states

## Usage

### Basic Authentication

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPrompt />;
  
  return <div>Welcome, {user?.name}!</div>;
}
```

### Route Protection

```tsx
import { AuthGuard } from '@/components/AuthGuard';

function ProtectedPage() {
  return (
    <AuthGuard>
      <div>This content is only visible to authenticated users</div>
    </AuthGuard>
  );
}
```

### Authentication Methods

```tsx
import { useAuth } from '@/contexts/AuthContext';

function LoginComponent() {
  const { authenticateWithTelegram, authenticateWithTelegramWebApp } = useAuth();
  
  const handleTelegramAuth = async (telegramUser) => {
    try {
      await authenticateWithTelegram(telegramUser);
      // User is now authenticated
    } catch (error) {
      // Handle authentication error
    }
  };
  
  const handleWebAppAuth = async (initData) => {
    try {
      await authenticateWithTelegramWebApp(initData);
      // User is now authenticated
    } catch (error) {
      // Handle authentication error
    }
  };
}
```

### Logout

```tsx
import { LogoutButton } from '@/components/LogoutButton';

function UserMenu() {
  return (
    <div>
      <span>Welcome, User!</span>
      <LogoutButton />
    </div>
  );
}
```

## Authentication Flow

### Telegram Widget Authentication

1. User clicks Telegram login widget
2. Telegram widget calls `onTelegramAuth` callback
3. `authenticateWithTelegram` is called with user data
4. API call is made to `/api/rest/telegram-auth`
5. User state is updated in context
6. User is redirected to intended page

### Telegram Web App Authentication

1. User opens app in Telegram
2. `initData` is extracted from Telegram Web App
3. `authenticateWithTelegramWebApp` is called with initData
4. API call is made to `/api/rest/telegram-auth/webapp`
5. User state is updated in context
6. User is redirected to intended page

### Logout Flow

1. User clicks logout button
2. Confirmation dialog is shown (optional)
3. `logout` function is called
4. API call is made to `/api/rest/logout`
5. Local storage is cleared
6. User state is reset
7. User is redirected to login page

## State Management

### User State

```typescript
interface User {
  id: string;
  tgUserId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  token?: string;
}
```

### Authentication State

```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authenticateWithTelegram: (user: any) => Promise<void>;
  authenticateWithTelegramWebApp: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  handleDeepLink: (router: any, searchParams: any, startParam?: string) => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}
```

## Error Handling

The authentication system provides comprehensive error handling:

- **Authentication errors** are displayed to users
- **Network errors** are handled gracefully
- **Token expiration** triggers automatic refresh
- **Logout failures** still clear local state

## Deep Link Handling

The system handles Telegram Web App deep links:

- **Start parameters** are processed automatically
- **Return URLs** are preserved after authentication
- **Navigation** is handled seamlessly

## Security Features

- **Token-based authentication** with JWT
- **Automatic token refresh** on expiration
- **Secure storage** of authentication tokens
- **CSRF protection** with credentials inclusion
- **Telegram SDK storage cleanup** on logout

## Best Practices

1. **Use the centralized auth context** instead of direct API calls
2. **Protect routes** with AuthGuard component
3. **Handle loading states** properly
4. **Provide user feedback** for authentication errors
5. **Clear sensitive data** on logout
6. **Use feature flags** for authentication methods

## Migration from Legacy Authentication

The old authentication system has been replaced with the centralized context:

```tsx
// Old way (deprecated)
import { useMe } from '@/hooks/api/useAuth';
const { data: user } = useMe();

// New way (recommended)
import { useAuth } from '@/contexts/AuthContext';
const { user, isAuthenticated } = useAuth();
```

## Testing

The authentication system can be tested with:

- **Mock authentication** for development
- **Telegram widget testing** with test users
- **Web App testing** with mock data
- **Error scenario testing** with invalid credentials

## Troubleshooting

### Common Issues

1. **Authentication not working** - Check API endpoints and credentials
2. **Token expiration** - Ensure token refresh is working
3. **Deep links not working** - Check Telegram Web App configuration
4. **Logout not working** - Check API endpoint and storage cleanup

### Debug Mode

Enable debug mode to see authentication flow:

```bash
NEXT_PUBLIC_ENABLE_DEBUG=true pnpm dev
```

This will show:
- Authentication state changes
- API call details
- Error messages
- Deep link processing
