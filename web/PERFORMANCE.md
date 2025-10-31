# Performance Optimization Guide

This guide outlines performance optimization strategies and best practices for the Meriter web frontend.

## 🚀 Core Web Vitals

### Largest Contentful Paint (LCP)
Target: < 2.5 seconds

**Optimization Strategies:**
- Use Next.js Image component for optimized images
- Implement lazy loading for below-the-fold content
- Optimize font loading with next/font
- Use CDN for static assets
- Implement proper caching strategies

### First Input Delay (FID)
Target: < 100 milliseconds

**Optimization Strategies:**
- Minimize JavaScript bundle size
- Use code splitting and dynamic imports
- Optimize React component rendering
- Implement proper memoization
- Reduce third-party script impact

### Cumulative Layout Shift (CLS)
Target: < 0.1

**Optimization Strategies:**
- Reserve space for dynamic content
- Use proper image dimensions
- Avoid inserting content above existing content
- Use CSS transforms instead of layout properties
- Implement skeleton loading states

## 📦 Bundle Optimization

### Code Splitting

```tsx
// Dynamic imports for route-based code splitting
const LazyComponent = dynamic(() => import('./LazyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

// Component-based code splitting
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### Tree Shaking

```tsx
// Import only what you need
import { debounce } from 'lodash/debounce';
import { format } from 'date-fns/format';

// Use barrel exports carefully
import { Button, Input } from '@/components'; // Good
import * as Components from '@/components'; // Avoid
```

### Bundle Analysis

```bash
# Analyze bundle size
pnpm build
pnpm analyze

# Check bundle composition
npx @next/bundle-analyzer
```

## 🖼️ Image Optimization

### Next.js Image Component

```tsx
import Image from 'next/image';

function OptimizedImage() {
  return (
    <Image
      src="/hero-image.jpg"
      alt="Hero image"
      width={800}
      height={600}
      priority // For above-the-fold images
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}
```

### Image Formats

- **WebP**: Modern format with better compression
- **AVIF**: Next-generation format (when supported)
- **Responsive Images**: Use srcSet for different screen sizes
- **Lazy Loading**: Load images only when needed

### Image Optimization Settings

```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

## ⚡ React Performance

### Memoization

```tsx
// Memoize expensive calculations
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      processed: expensiveOperation(item),
    }));
  }, [data]);

  return <div>{/* Render processed data */}</div>;
});

// Memoize event handlers
const MyComponent = () => {
  const handleClick = useCallback((id: string) => {
    // Handle click
  }, []);

  return <button onClick={handleClick}>Click me</button>;
};
```

### Virtual Scrolling

```tsx
import { FixedSizeList as List } from 'react-window';

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index]}
    </div>
  );

  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### Component Optimization

```tsx
// Avoid unnecessary re-renders
const OptimizedComponent = React.memo(({ data, onUpdate }) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data.id === nextProps.data.id;
});

// Use refs for DOM manipulation
const MyComponent = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const focusInput = () => {
    inputRef.current?.focus();
  };

  return <input ref={inputRef} />;
};
```

## 🌐 Network Optimization

### Caching Strategies

```tsx
// React Query caching
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});

// Service Worker caching
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
```

### Preloading

```tsx
// Preload critical resources
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossOrigin="" />
<link rel="preload" href="/api/users" as="fetch" crossOrigin="anonymous" />

// Prefetch next page
<Link href="/next-page" prefetch>
  Next Page
</Link>
```

### Compression

```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
};
```

## 🗄️ Data Fetching Optimization

### React Query Optimization

```tsx
// Optimize query configuration
const { data, isLoading } = useQuery({
  queryKey: ['posts', { page, limit }],
  queryFn: () => fetchPosts({ page, limit }),
  keepPreviousData: true, // Keep previous data while loading
  staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  refetchOnWindowFocus: false, // Don't refetch on window focus
  refetchOnMount: false, // Don't refetch on component mount
});

// Optimize mutations
const mutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries(['posts']);
  },
  onError: (error) => {
    // Handle errors
    console.error('Failed to create post:', error);
  },
});
```

### Pagination

```tsx
// Implement efficient pagination
const useInfinitePosts = () => {
  return useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 0 }) => fetchPosts({ page: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length : undefined;
    },
  });
};
```

## 🎨 CSS Optimization

### Critical CSS

```tsx
// Inline critical CSS
<style jsx>{`
  .hero {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`}</style>
```

### CSS-in-JS Optimization

```tsx
// Use styled-components with proper optimization
const StyledComponent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ theme }) => theme.mediaQueries.tablet} {
    flex-direction: column;
  }
`;
```

### Tailwind CSS Optimization

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Custom theme extensions
    },
  },
  plugins: [
    // Only include necessary plugins
  ],
};
```

## 📱 Mobile Optimization

### Touch Optimization

```tsx
// Optimize touch interactions
const TouchOptimizedButton = styled.button`
  min-height: 44px; /* Minimum touch target size */
  min-width: 44px;
  touch-action: manipulation; /* Disable double-tap zoom */
  
  &:active {
    transform: scale(0.95); /* Visual feedback */
  }
`;
```

### Responsive Images

```tsx
// Responsive image implementation
const ResponsiveImage = () => (
  <Image
    src="/hero.jpg"
    alt="Hero image"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ objectFit: 'cover' }}
  />
);
```

### Viewport Optimization

```html
<!-- Optimize viewport for mobile -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
```

## 🔍 Monitoring and Analysis

### Performance Monitoring

```tsx
// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Bundle Analysis

```bash
# Analyze bundle composition
pnpm build
pnpm analyze

# Check for duplicate dependencies
npx npm-check-duplicates

# Analyze bundle size
npx bundlephobia [package-name]
```

### Performance Testing

```tsx
// Performance testing with React Profiler
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration) {
  console.log('Render:', id, phase, actualDuration);
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <MyComponent />
    </Profiler>
  );
}
```

## 🛠️ Development Tools

### Performance DevTools

1. **React Developer Tools**: Profile component performance
2. **Chrome DevTools**: Analyze network and rendering performance
3. **Lighthouse**: Audit performance and accessibility
4. **WebPageTest**: Detailed performance analysis
5. **Bundle Analyzer**: Analyze bundle composition

### Performance Budgets

```javascript
// next.config.js
module.exports = {
  experimental: {
    // Set performance budgets
    optimizePackageImports: ['lodash', 'date-fns'],
  },
};
```

## 📊 Performance Metrics

### Key Metrics to Track

1. **Core Web Vitals**: LCP, FID, CLS
2. **Bundle Size**: JavaScript and CSS bundle sizes
3. **Load Time**: Initial page load time
4. **Time to Interactive**: When page becomes interactive
5. **First Contentful Paint**: When first content appears

### Performance Goals

- **LCP**: < 2.5 seconds
- **FID**: < 100 milliseconds
- **CLS**: < 0.1
- **Bundle Size**: < 250KB (gzipped)
- **Load Time**: < 3 seconds
- **TTI**: < 5 seconds

## 🚀 Deployment Optimization

### Production Build

```bash
# Optimized production build
pnpm build

# Analyze bundle
pnpm analyze

# Check for performance issues
pnpm lighthouse
```

### CDN Configuration

```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://cdn.example.com' : '',
  images: {
    domains: ['cdn.example.com'],
  },
};
```

### Service Worker

```javascript
// sw.js
const CACHE_NAME = 'meriter-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});
```
