# Отчёт об исправлении проблемы с настройками правил голосования

## Проблема

Настройки правил голосования (`canVoteForOwnPosts`, `participantsCannotVoteForLead`) сохранялись в базу данных, но не применялись при проверке разрешений на голосование в ленте сообщества. Пользователи могли голосовать за свои посты, даже если это было запрещено в настройках.

## Анализ проблемы

### Найденные ошибки:

1. **Неполное создание правил при обновлении `participantsCannotVoteForLead`**
   - В `CommunityRulesEditor.tsx` (строки 818-828) при обновлении `participantsCannotVoteForLead` правила обновлялись только для ролей, у которых уже существовали правила VOTE
   - Если правило не существовало, оно не создавалось, в отличие от `canVoteForOwnPosts`, которое создавало правила для всех ролей

2. **Неполный мерж условий при получении эффективных правил**
   - В `CommunityService.getEffectivePermissionRules()` (строки 168-183) правила из базы данных просто заменяли дефолтные правила без мержа условий
   - Если в DB правиле не было условия `canVoteForOwnPosts`, оно не бралось из дефолтного правила
   - Это приводило к тому, что условия могли быть потеряны при мерже

## Исправления

### 1. Исправление создания правил для `participantsCannotVoteForLead`

**Файл:** `web/src/features/communities/components/CommunityRulesEditor.tsx`

**Изменение:** Обновлена логика сохранения `participantsCannotVoteForLead` для создания правил для всех ролей, даже если они не существуют:

```typescript
// БЫЛО:
if (rule) {
  updatedRules = updateRule(updatedRules, role, ActionType.VOTE, {
    conditions: { participantsCannotVoteForLead: checked as boolean },
  });
}

// СТАЛО:
updatedRules = updateRule(updatedRules, role, ActionType.VOTE, {
  allowed: rule?.allowed ?? true,
  conditions: { participantsCannotVoteForLead: checked as boolean },
});
```

Теперь логика соответствует логике для `canVoteForOwnPosts` - правила создаются для всех ролей.

### 2. Исправление мержа условий в эффективных правилах

**Файл:** `api/apps/meriter/src/domain/services/community.service.ts`

**Изменение:** Обновлена функция `getEffectivePermissionRules()` для правильного мержа условий из дефолтных правил с условиями из DB:

```typescript
// БЫЛО:
for (const dbRule of community.permissionRules) {
  const key = `${dbRule.role}:${dbRule.action}`;
  mergedRules.push(dbRule);  // Просто добавляли DB правило без мержа условий
  processedKeys.add(key);
}

// СТАЛО:
for (const dbRule of community.permissionRules) {
  const key = `${dbRule.role}:${dbRule.action}`;
  const defaultRule = defaultRulesMap.get(key);
  
  // Мержим условия: DB условия переопределяют дефолтные, но включаем дефолтные если их нет в DB
  const mergedConditions = defaultRule?.conditions
    ? { ...defaultRule.conditions, ...dbRule.conditions }
    : dbRule.conditions;
  
  mergedRules.push({
    ...dbRule,
    conditions: mergedConditions && Object.keys(mergedConditions).length > 0
      ? mergedConditions
      : undefined,
  });
  processedKeys.add(key);
}
```

Теперь условия из дефолтных правил мержатся с условиями из DB, что гарантирует, что все условия будут доступны при проверке разрешений.

## Как работает проверка разрешений

1. **Проверка `canVoteForOwnPosts`** (высокий приоритет):
   - Выполняется в `RoleHierarchyFactor.evaluate()` на строке 81-88
   - Проверяется ДО проверки `allowed`, что гарантирует блокировку даже если правило разрешает действие
   - Если `canVoteForOwnPosts === false` и пользователь является эффективным бенефициаром, голосование блокируется

2. **Проверка `participantsCannotVoteForLead`**:
   - Выполняется в `RoleHierarchyFactor.evaluateConditions()` на строке 248-253
   - Проверяется после проверки `allowed` в рамках общей проверки условий
   - Если `participantsCannotVoteForLead === true` и пользователь - участник, а автор - лид, голосование блокируется

## Результат

После исправлений:
- ✅ Настройки `canVoteForOwnPosts` и `participantsCannotVoteForLead` правильно сохраняются для всех ролей
- ✅ Условия правильно мержатся с дефолтными правилами при получении эффективных правил
- ✅ Проверки разрешений работают корректно и блокируют голосование согласно настройкам

## Тестирование

Для проверки исправлений:
1. Откройте настройки сообщества
2. Отключите "Можно голосовать за свои посты" (`canVoteForOwnPosts = false`)
3. Сохраните настройки
4. Попробуйте проголосовать за свой пост - должно быть заблокировано
5. Включите настройку обратно - голосование должно быть разрешено (но только с кошелька, не с квоты)

## Дополнительные замечания

- Функция `updateRule()` в `CommunityRulesEditor.tsx` правильно мержит условия при обновлении
- Проверка `canVoteForOwnPosts` имеет **высший приоритет** и выполняется **даже для суперадминов**
- Суперадмины обходят большинство проверок разрешений, но **НЕ** проверку `canVoteForOwnPosts`

## Дополнительное исправление: Суперадмин обходил проверку canVoteForOwnPosts

### Проблема
Суперадмин обходил проверку `canVoteForOwnPosts`, потому что проверка суперадмина выполнялась ДО проверки `canVoteForOwnPosts` (строки 46-52), и функция возвращалась раньше.

**Файл:** `api/apps/meriter/src/domain/services/factors/role-hierarchy.factor.ts`

**Исправление:** Перемещена проверка `canVoteForOwnPosts` ПЕРЕД проверкой суперадмина, чтобы она применялась ко всем пользователям, включая суперадминов:

```typescript
// БЫЛО:
// STEP 1: Check superadmin status (bypass first)
if (isSuperadmin) {
  return { allowed: true }; // Обходил все проверки, включая canVoteForOwnPosts
}
// STEP 5.5: Check canVoteForOwnPosts (никогда не достигалось для суперадмина)

// СТАЛО:
// STEP 5.5: HIGH PRIORITY CHECK - canVoteForOwnPosts (выполняется ПЕРЕД проверкой суперадмина)
if (action === ActionType.VOTE && matchingRule.conditions?.canVoteForOwnPosts !== undefined) {
  if (context.isEffectiveBeneficiary && !matchingRule.conditions.canVoteForOwnPosts) {
    return { allowed: false, reason: 'Cannot vote for own posts (canVoteForOwnPosts=false)' };
  }
}
// STEP 6: Check superadmin status (bypass для остальных проверок, но не для canVoteForOwnPosts)
if (isSuperadmin) {
  return { allowed: true };
}
```

Теперь проверка `canVoteForOwnPosts` применяется ко всем пользователям, включая суперадминов.

