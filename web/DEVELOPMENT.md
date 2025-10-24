# Development Guide

This guide provides detailed information for developers working on the Meriter web frontend.

## 🏗️ Architecture Overview

### Design Patterns

The application follows several key design patterns:

1. **Feature-Based Architecture**: Code is organized by features rather than file types
2. **Atomic Design**: Components are organized into atoms, molecules, organisms, and templates
3. **Dependency Injection**: Services and utilities are injected rather than directly imported
4. **Observer Pattern**: React Query and context providers manage state changes
5. **Factory Pattern**: API clients and utilities are created using factory functions

### State Management

- **Server State**: React Query (TanStack Query) for API data
- **Client State**: React Context for global application state
- **Form State**: Controlled components with React hooks
- **URL State**: Next.js router for navigation state

### Data Flow

1. **User Interaction** → Component
2. **Component** → Custom Hook
3. **Custom Hook** → API Client
4. **API Client** → Backend
5. **Backend Response** → React Query Cache
6. **Cache Update** → Component Re-render

## 🧩 Component Development

### Component Structure

```tsx
interface ComponentProps {
  // Props interface
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const { data, isLoading } = useQuery();
  
  // Event handlers
  const handleClick = useCallback(() => {
    // Handler logic
  }, []);
  
  // Early returns
  if (isLoading) return <LoadingSpinner />;
  if (!data) return <EmptyState />;
  
  // Main render
  return (
    <div className="component">
      {/* JSX content */}
    </div>
  );
}
```

### Component Guidelines

1. **Single Responsibility**: Each component should have one clear purpose
2. **Props Interface**: Define clear TypeScript interfaces for props
3. **Error Boundaries**: Wrap components that might fail
4. **Accessibility**: Include proper ARIA labels and keyboard navigation
5. **Performance**: Use React.memo, useMemo, and useCallback when appropriate

### Atomic Design Implementation

#### Atoms
Basic building blocks that cannot be broken down further:
- Buttons
- Inputs
- Labels
- Icons

#### Molecules
Simple combinations of atoms:
- Search forms
- Navigation items
- Card headers
- Form fields

#### Organisms
Complex combinations of molecules and atoms:
- Navigation bars
- Content cards
- Form sections
- Data tables

#### Templates
Page layouts that define the structure:
- Page layouts
- Grid systems
- Content areas

## 🔌 API Integration

### API Client Usage

```tsx
import { apiClient } from '@/lib/api';

// GET request
const data = await apiClient.get('/endpoint');

// POST request
const result = await apiClient.post('/endpoint', payload);

// With error handling
try {
  const data = await apiClient.get('/endpoint');
  return data;
} catch (error) {
  console.error('API Error:', error);
  throw error;
}
```

### React Query Integration

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Query hook
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hook
export function useCreateUser() {
  return useMutation({
    mutationFn: (userData) => apiClient.post('/users', userData),
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries(['users']);
    },
  });
}
```

### Error Handling

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

## 🔐 Authentication

### Auth Context Usage

```tsx
import { useAuth } from '@/contexts/AuthContext';

function ProtectedComponent() {
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
      <div>Protected content</div>
    </AuthGuard>
  );
}
```

### Authentication Methods

1. **Telegram Widget**: For web users
2. **Telegram Web App**: For Telegram users
3. **Token-based**: JWT tokens for API authentication

## 🎨 Styling

### Tailwind CSS

Use Tailwind utility classes for styling:

```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-bold text-gray-800">Title</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Action
  </button>
</div>
```

### DaisyUI Components

Use DaisyUI components for consistent design:

```tsx
<button className="btn btn-primary">Primary Button</button>
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">Card Title</h2>
    <p>Card content</p>
  </div>
</div>
```

### Custom Styles

For custom styles, use CSS modules or styled-components:

```tsx
// styles.module.css
.customButton {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  color: white;
  font-weight: 600;
}

// Component
import styles from './styles.module.css';

<button className={styles.customButton}>Custom Button</button>
```

## 🌐 Internationalization

### Adding Translations

1. Add translations to `messages/en.json` and `messages/ru.json`
2. Use the `useTranslations` hook in components
3. Provide fallbacks for missing translations

```tsx
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('namespace');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Translation Files

```json
{
  "namespace": {
    "title": "Page Title",
    "description": "Page description",
    "button": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

## 🧪 Testing

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
  
  it('handles user interaction', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    button.click();
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### Hook Testing

```tsx
import { renderHook } from '@testing-library/react';
import { useCustomHook } from './useCustomHook';

describe('useCustomHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useCustomHook());
    expect(result.current.value).toBe(0);
  });
  
  it('updates state correctly', () => {
    const { result } = renderHook(() => useCustomHook());
    act(() => {
      result.current.increment();
    });
    expect(result.current.value).toBe(1);
  });
});
```

### API Testing

```tsx
import { apiClient } from '@/lib/api';

describe('API Client', () => {
  it('makes GET requests', async () => {
    const mockResponse = { data: 'test' };
    mockFetch(mockResponse);
    
    const response = await apiClient.get('/test');
    expect(response).toEqual(mockResponse);
  });
});
```

## 🚀 Performance Optimization

### React Performance

1. **Memoization**: Use React.memo, useMemo, and useCallback
2. **Code Splitting**: Use dynamic imports for large components
3. **Lazy Loading**: Load components only when needed
4. **Virtual Scrolling**: For large lists

### Bundle Optimization

1. **Tree Shaking**: Remove unused code
2. **Dynamic Imports**: Split code into chunks
3. **Image Optimization**: Use Next.js Image component
4. **Font Optimization**: Use Next.js Font optimization

### Caching Strategy

1. **Static Generation**: For pages that don't change often
2. **Incremental Static Regeneration**: For pages that change occasionally
3. **Client-side Caching**: Use React Query for API data
4. **Service Worker**: For offline functionality

## 🔧 Development Tools

### VS Code Extensions

Recommended extensions for development:

- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Tailwind CSS IntelliSense
- Prettier - Code formatter
- ESLint
- GitLens

### Debugging

1. **React Developer Tools**: For component debugging
2. **Redux DevTools**: For state debugging
3. **Network Tab**: For API debugging
4. **Console Logging**: For general debugging

### Code Quality

1. **ESLint**: For code linting
2. **Prettier**: For code formatting
3. **TypeScript**: For type checking
4. **Husky**: For git hooks
5. **Lint-staged**: For pre-commit checks

## 📚 Best Practices

### Code Organization

1. **Feature-based Structure**: Organize code by features
2. **Barrel Exports**: Use index files for clean imports
3. **Consistent Naming**: Use consistent naming conventions
4. **Documentation**: Document complex logic and APIs

### Error Handling

1. **Error Boundaries**: Catch and handle React errors
2. **Try-Catch Blocks**: Handle async operations
3. **Fallback UI**: Provide fallback components
4. **Error Logging**: Log errors for debugging

### Security

1. **Input Validation**: Validate all user inputs
2. **XSS Prevention**: Sanitize user content
3. **CSRF Protection**: Use CSRF tokens
4. **Secure Headers**: Set security headers

### Accessibility

1. **Semantic HTML**: Use proper HTML elements
2. **ARIA Labels**: Add accessibility labels
3. **Keyboard Navigation**: Support keyboard users
4. **Screen Readers**: Test with screen readers

## 🚀 Deployment

### Build Process

1. **Type Checking**: Ensure no TypeScript errors
2. **Linting**: Fix all ESLint errors
3. **Testing**: Run all tests
4. **Building**: Create production build
5. **Optimization**: Optimize assets

### Environment Configuration

1. **Environment Variables**: Set production variables
2. **Build Configuration**: Configure build settings
3. **Asset Optimization**: Optimize images and fonts
4. **CDN Setup**: Configure CDN for assets

### Monitoring

1. **Error Tracking**: Set up error monitoring
2. **Performance Monitoring**: Monitor performance metrics
3. **Analytics**: Track user behavior
4. **Uptime Monitoring**: Monitor application uptime
