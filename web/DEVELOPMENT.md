# Development Guide

## Detecting Infinite Re-render Loops

React error #310 (Maximum update depth exceeded) indicates infinite re-render loops. Here's how to detect and prevent them:

### 1. React Strict Mode (Already Enabled)

React Strict Mode is enabled in `next.config.js` (`reactStrictMode: true`). This helps catch issues in development by:
- Double-invoking render methods
- Detecting unsafe lifecycle methods
- Warning about deprecated APIs

### 2. ESLint Rules

The project uses `eslint-plugin-react-hooks` with:
- `react-hooks/rules-of-hooks`: 'error' - Prevents conditional hook calls
- `react-hooks/exhaustive-deps`: 'warn' (or 'error' in CI) - Warns about missing dependencies

**Common issues caught:**
- Missing dependencies in `useEffect`, `useMemo`, `useCallback`
- Conditional hook calls
- Hooks called in loops or conditions

### 3. Development Hooks

#### `useRenderCount`

Track component render counts to detect excessive renders:

```tsx
import { useRenderCount } from '@/hooks/useRenderCount';

function MyComponent() {
  useRenderCount({ name: 'MyComponent', warnThreshold: 20 });
  // ... component code
}
```

This will:
- Log warnings after 50 renders (default)
- Throw error after 100 renders (default, development only)
- Help identify which component is causing issues

#### `useStableMemo`

Create memoized values that only update when dependencies deeply change:

```tsx
import { useStableMemo } from '@/hooks/useStableMemo';

function MyComponent({ config }) {
  // This won't re-render if config object has same values but different reference
  const stableValue = useStableMemo(() => {
    return computeExpensiveValue(config);
  }, [config]);
}
```

### 4. Static Analysis Script

Run the render loop checker before committing:

```bash
pnpm check:render-loops
```

This checks for:
- Function calls in render that create new objects/arrays
- `useMemo` with function call dependencies
- State updates in render (outside useEffect)
- Missing dependencies

The script runs automatically before builds (`prebuild` hook).

### 5. CI/CD Checks

The GitHub Actions workflow (`.github/workflows/render-loop-check.yml`) automatically:
- Runs render loop checks on PRs
- Runs ESLint in strict mode (exhaustive-deps as error)
- Fails the build if issues are found

### 6. React DevTools Profiler

Use React DevTools Profiler to:
1. Record a session
2. Look for components with excessive renders
3. Check render times and reasons for re-renders

### Common Patterns to Avoid

#### ❌ Bad: Creating new objects/arrays in render

```tsx
function Component() {
  const providers = getEnabledProviders(getAuthEnv(null)); // New array every render!
  return <AuthWrapper providers={providers} />;
}
```

#### ✅ Good: Memoize the value

```tsx
function Component() {
  const providers = useMemo(() => {
    return getEnabledProviders(getAuthEnv(null));
  }, []); // Only compute once
  return <AuthWrapper providers={providers} />;
}
```

#### ❌ Bad: Unstable dependencies

```tsx
function Component({ config }) {
  const value = useMemo(() => compute(config), [config]); // config might be new object each render
}
```

#### ✅ Good: Use stable memo or extract primitives

```tsx
function Component({ config }) {
  const value = useStableMemo(() => compute(config), [config]);
  // OR
  const { enabled } = config;
  const value = useMemo(() => compute(config), [enabled]);
}
```

### Debugging Tips

1. **Add render counting to suspicious components:**
   ```tsx
   useRenderCount({ name: 'SuspiciousComponent', logAll: true });
   ```

2. **Check React DevTools:**
   - Look for components with high render counts
   - Check "Why did this render?" in Profiler

3. **Use console logs:**
   ```tsx
   useEffect(() => {
     console.log('Component rendered', { props, state });
   });
   ```

4. **Check for state updates in render:**
   - Never call `setState` directly in render
   - Always use `useEffect` or event handlers

### Prevention Checklist

Before committing, ensure:
- [ ] `pnpm check:render-loops` passes
- [ ] `pnpm lint` passes (no exhaustive-deps warnings)
- [ ] No function calls in render that create objects/arrays
- [ ] All `useMemo`/`useCallback` dependencies are stable
- [ ] No state updates in render (outside hooks)

