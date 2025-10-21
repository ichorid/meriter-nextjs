# Quick I18N How-To

## Add Translations to Any Component (3 Steps)

### Step 1: Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook
```typescript
export const MyComponent = () => {
    const { t } = useTranslation('namespace'); // polls, feed, comments, shared, etc.
    // ... rest of component
}
```

### Step 3: Replace Strings
```typescript
// Before
<div>Текст</div>

// After
<div>{t('textKey')}</div>
```

## Common Patterns

### With Variables
```typescript
// Translation file
"greeting": "Hello {{name}}"

// Component
{t('greeting', { name: userName })}
```

### Conditional
```typescript
{isActive ? t('active') : t('inactive')}
```

### Plurals
```typescript
// Translation file  
"items": "{{count}} item",
"items_plural": "{{count}} items"

// Component
{t('items', { count: 5 })} // "5 items"
```

## Check Your Work

```bash
# See remaining Russian strings
grep -r -P '[А-Яа-яЁё]' src/ --include="*.tsx" | wc -l

# Test
pnpm dev
# Go to Settings → Change language
```

## Need Help?

See completed examples:
- Simple: `src/features/wallet/components/bar-withdraw.tsx`
- Complex: `src/features/polls/components/form-poll-create.tsx`
