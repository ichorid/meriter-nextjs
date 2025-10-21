# I18N Migration Completion Guide

## Status: 60% Complete

### ✅ Completed (15 files)
- All infrastructure (10 translation files, config, provider)
- Core pages (home, login, settings)  
- Poll components (form-poll-create, poll-voting, poll)
- Wallet components: bar-withdraw, form-withdraw

### ⏳ Remaining (20 files, ~130 Russian strings)

## Quick Reference Pattern

Every component follows this pattern:

```typescript
// 1. Add import (top of file)
import { useTranslation } from 'react-i18next';

// 2. Add hook (inside component)
const { t } = useTranslation('namespace');  // namespace: polls, feed, comments, shared, etc.

// 3. Replace Russian strings
"Русский текст" → {t('keyName')}
placeholder="Русский текст" → placeholder={t('keyName')}
```

## Remaining Files by Priority

### HIGH PRIORITY (User-facing)

#### 1. Comment Components (4 files)
**Namespace:** `comments`

**`web/src/features/comments/components/form-comment-vote.tsx`**
- Lines with Russian: ~15
- Add: `const { t } = useTranslation('comments');`
- Replace:
  - `Плюсануть на {X}/{Y} суточной квоты` → `{t('upvoteQuota', { used: X, total: Y })}`
  - `Плюсануть на {X} с Баланса` → `{t('upvoteBalance', { amount: X })}`
  - `Слайдер вправо - плюсануть` → `{t('sliderUpvote')}`
  - `Слайдер влево - минусануть` → `{t('sliderDownvote')}`
  - `Минусануть на {X}/{Y} суточной квоты` → `{t('downvoteQuota', { used: X, total: Y })}`
  - `Минусануть на {X} с Баланса` → `{t('downvoteBalance', { amount: X })}`
  - `Двигайте слайдер...` → `{t('sliderHint')}`
  - `Расскажите, почему...` → `{t('commentHint')}`

**`web/src/features/comments/components/form-comment.tsx`**
- Lines with Russian: ~10
- Add: `const { t } = useTranslation('comments');`
- Replace:
  - `закрыть[x]` → `{t('close')}`
  - `Минусовое голосование возможно только с Баланса. ` → `{t('downvoteRequiresBalance')}`
  - `Cнимите баллы с публикаций на свой Баланс` → `{t('withdrawToBalance')}`
  - `Недостаточно баллов. ` → `{t('insufficientPoints')}`
  - `Добавьте их на свой Баланс` → `{t('addToBalance')}`

**`web/src/features/comments/components/comment.tsx`**
- Lines with Russian: ~8
- Add: `const { t } = useTranslation('comments');`
- Replace similar to publication.tsx:
  - `Добавить/Снять меритов: {amount}` → `{t(directionAdd ? 'addMerits' : 'removeMerits', { amount })}`
  - `Добавить/Снять баллов сообщества: {amount}` → `{t(directionAdd ? 'addCommunityPoints' : 'removeCommunityPoints', { amount })}`
  - `Мериты` → `{t('merits')}`
  - `Баллы` → `{t('points')}`

**`web/src/features/comments/hooks/use-comments.ts`**
- Lines with Russian: 1
- Add: Import at top level (this is a hook, different pattern)
- Replace: `Введите комментарий!` → `t('enterComment')`

#### 2. Feed Components (2 files)
**Namespace:** `feed`

**`web/src/features/feed/components/components.tsx`**
- Lines with Russian: ~4
- Add: `const { t } = useTranslation('feed');`
- Replace:
  - `Сохраняю...` → `{t('saving')}`
  - `Сохранено!` → `{t('saved')}`
  - `← Назад` → `{t('back')}`
  - `+ Добавить публикацию` → `{t('addPublication')}`

**`web/src/features/feed/components/publication.tsx`**
- Lines with Russian: ~8
- Add: `const { t } = useTranslation('feed');`
- Replace:
  - `{tgAuthorName} для {beneficiaryName}` → `{t('forBeneficiary', { author: tgAuthorName, beneficiary: beneficiaryName })}`
  - `Добавить меритов: {amount}` → `{t('addMerits', { amount })}`
  - `Снять меритов: {amount}` → `{t('removeMerits', { amount })}`
  - `Добавить баллов сообщества: {amount}` → `{t('addCommunityPoints', { amount })}`
  - `Снять баллов сообщества: {amount}` → `{t('removeCommunityPoints', { amount })}`
  - `📊 Опрос (Мой)` → `{t('pollMy')}`
  - `📊 Опрос` → `{t('poll')}`
  - `Мериты` → `{t('merits')}`
  - `Баллы` → `{t('points')}`

#### 3. Wallet Components (2 remaining)
**Namespace:** `shared`

**`web/src/features/wallet/components/widget-avatar-balance.tsx`**
- Lines with Russian: 1
- Add: `const { t } = useTranslation('shared');`
- Replace: `Баланс: ` → `{t('balance')}`

**`web/src/features/wallet/components/transaction-to-me.tsx`**
- Lines with Russian: ~4
- Add: `const { t } = useTranslation('shared');`
- Replace:
  - `от ` → `{t('from')}`
  - `В ответ на: ` → `{t('inReplyTo')}`
  - `эту запись` → `{t('thisPost')}`

### MEDIUM PRIORITY (Admin/Settings)

#### 4. Community Components (1 file)
**Namespace:** `communities`

**`web/src/features/communities/components/form-dimensions-editor.tsx`**
- Lines with Russian: 1
- Add: `const { t } = useTranslation('communities');`
- Replace: `Другое` → `{t('other')}`

#### 5. Shared Components (4 files)
**Namespace:** `shared`

**`web/src/shared/components/menu-breadcrumbs.tsx`**
- Check for Russian strings

**`web/src/shared/components/logout-button.tsx`**
- Lines with Russian: 1
- Add: `const { t } = useTranslation('shared');`
- Replace: `Выйти` → `{t('logout')}`

**`web/src/shared/components/updates-frequency.tsx`**
- Check for Russian strings

**`web/src/shared/components/iconpicker.tsx`**
- Check for Russian strings

### LOW PRIORITY (Less frequently used)

#### 6. App Pages (5 files)
These require individual inspection as they may have unique strings.

- `web/src/app/meriter/setup-community/page.tsx`
- `web/src/app/meriter/commbalance/page.tsx`
- `web/src/app/meriter/spaces/[slug]/page.tsx`
- `web/src/app/meriter/communities/[id]/page.tsx`
- `web/src/app/meriter/communities/[id]/posts/[slug]/page.tsx`

#### 7. Utility Libraries (2 files)
**Namespace:** `shared`

**`web/src/shared/lib/date.ts`**
- May have month names, date formatting strings
- Use i18next date formatting utilities

**`web/src/shared/lib/getIcon.ts`**
- Check for Russian strings

## Verification Commands

### Find remaining Russian strings:
```bash
cd web
grep -r -P '[А-Яа-яЁё]' src/ --include="*.tsx" --include="*.ts" | wc -l
```

### List files with Russian:
```bash
grep -r -l -P '[А-Яа-яЁё]' src/ --include="*.tsx" --include="*.ts"
```

### Check specific file:
```bash
grep -n -P '[А-Яа-яЁё]' src/path/to/file.tsx
```

## Testing Checklist

After completing each file:

1. **Compile check**: `pnpm build` (check for TypeScript errors)
2. **Visual test**: Load component in English
3. **Visual test**: Load component in Russian
4. **Switch test**: Change language while component is loaded
5. **No console errors**: Check browser console

## Common Patterns

### Simple text replacement:
```tsx
// Before
<div>Текст</div>

// After  
<div>{t('textKey')}</div>
```

### Placeholder replacement:
```tsx
// Before
<input placeholder="Введите текст" />

// After
<input placeholder={t('enterText')} />
```

### Interpolation (variables in text):
```tsx
// Before
`Найдено ${count} сообществ`

// After
t('foundCommunities', { count })

// In translation file:
"foundCommunities": "Found {{count}} communities"
```

### Conditional text:
```tsx
// Before
{isActive ? "Активен" : "Завершен"}

// After
{isActive ? t('active') : t('finished')}
```

### Dynamic text with variables:
```tsx
// Before
const doWhat = directionAdd ? "Добавить" : "Снять";
return `${doWhat} баллов: ${amount}`;

// After
return directionAdd 
  ? t('addPoints', { amount })
  : t('removePoints', { amount });
```

## Troubleshooting

### "t is not defined"
- Add `const { t } = useTranslation('namespace');` inside component

### "useTranslation is not defined"
- Add `import { useTranslation } from 'react-i18next';` at top

### "Missing translation key"
- Check translation files in `public/locales/en/` and `public/locales/ru/`
- Ensure key exists in both files

### "Wrong namespace"
- Verify you're using correct namespace in `useTranslation('namespace')`
- Check `/plan.md` for file-to-namespace mapping

## Adding New Translation Keys

If you need a key that doesn't exist:

1. Add to English: `web/public/locales/en/[namespace].json`
2. Add to Russian: `web/public/locales/ru/[namespace].json`
3. Use in component: `t('newKey')`

## Final Verification

When complete, run:

```bash
# Should return 0
cd web && grep -r -P '[А-Яа-яЁё]' src/ --include="*.tsx" --include="*.ts" | wc -l

# Test dev server
pnpm dev

# Test build
pnpm build
```

## Estimated Time

- Simple components (1-5 strings): 5-10 minutes each
- Complex components (10+ strings): 15-30 minutes each
- **Total remaining**: ~4-6 hours of focused work

## Getting Help

If stuck, reference completed files:
- Simple example: `src/features/wallet/components/bar-withdraw.tsx`
- Complex example: `src/features/polls/components/form-poll-create.tsx`
- Hook usage: `src/app/meriter/home/page.tsx`

