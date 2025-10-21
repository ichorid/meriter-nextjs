# How to Use Internationalization

## For Users

### Changing Language
1. Log in to Meriter
2. Click your avatar (top right) or go to `/meriter/settings`
3. Find "Interface Language" / "Язык интерфейса" section
4. Choose from:
   - **Auto (Browser Default)** - Automatically detects your browser language
   - **English** - Always show in English
   - **Русский** - Always show in Russian
5. Language changes instantly without page reload

### What Gets Translated
- All UI elements (buttons, labels, headings)
- Form placeholders and validation messages
- Error messages
- Date/time formatting
- All navigation and menus

### What Doesn't Get Translated
- User-generated content (posts, comments)
- Usernames
- Community names
- URLs

## For Developers

### Adding Translations to a Component

**Step 1**: Import the hook
```typescript
import { useTranslation } from 'react-i18next';
```

**Step 2**: Use in component
```typescript
export const MyComponent = () => {
  const { t } = useTranslation('namespace'); // See namespaces below
  
  return <div>{t('keyName')}</div>;
}
```

**Step 3**: Add translations to files
```json
// public/locales/en/namespace.json
{
  "keyName": "English text"
}

// public/locales/ru/namespace.json
{
  "keyName": "Русский текст"
}
```

### Namespaces

| Namespace | Use For |
|-----------|---------|
| `common` | Shared UI (Save, Cancel, Close, etc.) |
| `home` | Home page |
| `login` | Login page |
| `settings` | Settings page |
| `polls` | Poll creation and voting |
| `feed` | Publications and feed |
| `comments` | Comments and voting |
| `wallet` | Wallet and transactions |
| `communities` | Community management |
| `shared` | Shared components |
| `pages` | Other app pages |

### Translation Patterns

#### Simple Text
```tsx
<button>{t('save')}</button>
```

#### With Variables
```tsx
// Translation file
{
  "greeting": "Hello {{name}}"
}

// Component
{t('greeting', { name: userName })}
```

#### Conditional Text
```tsx
{isActive ? t('active') : t('inactive')}
```

#### Plurals
```tsx
// i18next handles this automatically
{t('items', { count: 5 })} // "5 items"
{t('items', { count: 1 })} // "1 item"
```

### Adding New Translation Keys

1. Add to English file: `public/locales/en/[namespace].json`
2. Add to Russian file: `public/locales/ru/[namespace].json`
3. Use in component: `t('newKey')`

### Common Issues

**"t is not defined"**
- Add `const { t } = useTranslation('namespace');` inside component

**"useTranslation is not defined"**
- Add `import { useTranslation } from 'react-i18next';` at top

**"Missing translation"**
- Check both en and ru translation files have the key
- Verify namespace is correct

**"Wrong language showing"**
- Clear localStorage: `localStorage.clear()`
- Check language selector in Settings

### Testing

```bash
# Check for remaining Russian strings
grep -r -P '[А-Яа-яЁё]' src/ --include="*.tsx" | wc -l

# Run dev server
pnpm dev

# Test build (note: pre-existing error in commbalance unrelated to i18n)
pnpm build
```

### Examples

**Simple**: `src/features/wallet/components/bar-withdraw.tsx`
**Medium**: `src/app/meriter/home/page.tsx`
**Complex**: `src/features/polls/components/form-poll-create.tsx`
**With hooks**: `src/features/comments/hooks/use-comments.ts`

## Architecture

- **Package**: react-i18next
- **Storage**: localStorage (key: `language`, values: `auto`/`en`/`ru`)
- **Detection**: Browser `navigator.language` when set to `auto`
- **Fallback**: English for non-Russian/English browsers
- **No URLs**: Language doesn't affect URLs
- **No database**: Preference is local per device/browser

## Need Help?

- See `I18N_IMPLEMENTATION_SUMMARY.md` for technical details
- See `I18N_MIGRATION_GUIDE.md` for migration instructions
- See `I18N_FINAL_REPORT.md` for completion status
- See `QUICK_I18N_HOWTO.md` for quick reference

