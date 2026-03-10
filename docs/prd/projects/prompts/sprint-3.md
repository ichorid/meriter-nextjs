# Sprint 3: Публикация на Биржу и распределение

Прочитай PRD: `@docs/prd/projects/SPRINT-3-PRD.md`
Прочитай отчёт предыдущего спринта: `@docs/prd/projects/reports/SPRINT-2-REPORT.md`
Правила: `@architecture.mdc` `@backend.mdc` `@frontend.mdc` `@business-investing.mdc` `@business-communities.mdc` `@business-merits.mdc`

**ЭТО САМЫЙ ТЕХНИЧЕСКИ СЛОЖНЫЙ СПРИНТ. Работай особенно внимательно.**

## Задача

Реализуй Sprint 3. Автономно, сериями. После каждой серии — билд.

**Перед Серией 3 (перехват withdraw):** Убедись, что в SPRINT-2-REPORT есть описание того, как устроено создание поста в проекте и где проверяется postType. Если в отчёте этого нет — после разведки кратко зафиксируй в текущем отчёте (блок «Решения по ходу» или «Контекст из разведки»), затем приступай к перехвату withdraw.

## Порядок работы

### Серия 1: Schema + shared-types
1. Расширь PublicationSchema: sourceEntityId (ObjectId, ref Community, default undefined), sourceEntityType (enum ['project','community'], default undefined)
2. Обнови shared-types: SourceEntityType enum
3. Проверь билд

### Серия 2: ProjectDistributionService (КРИТИЧЕСКОЕ) + тесты
1. Создай `domain/services/project-distribution.service.ts`:
   - `distribute(projectId, authorShare)`:
     1. Получить project (founderSharePercent, founderUserId)
     2. `shares = getProjectShares(projectId)` → total
     3. Если total == 0 → всё фаундеру одним wallet deposit. Return.
     4. founderFixed = authorShare × founderSharePercent / 100
     5. teamPool = authorShare - founderFixed
     6. Для каждого (вкл. фаундера): share = teamPool × (participantMerits / total) → wallet deposit
     7. Фаундер итого = founderFixed + teamShare
     8. Округление: каждая доля до 2 знаков (например Math.floor(share*100)/100). Остаток = authorShare - sum(округлённых) → фаундеру.
     9. CommunityWallet.totalDistributed += authorShare (balance НЕ трогаем!)
2. Добавь тесты для distribute: totalInternalMerits=0 (всё фаундеру); totalInternalMerits>0 (формула, округление, остаток фаундеру, balance не меняется, totalDistributed растёт). См. SPRINT-3-PRD «Критические тесты».
3. Проверь билд

### Серия 3: Перехват withdraw flow (КРИТИЧЕСКОЕ)
1. **Найди** ТОЧНОЕ место в коде где publications.withdraw зачисляет authorShare на кошелёк автора. Это может быть в wallet.service.ts, publication.service.ts или в самом publications.router.ts.
2. **Найди** merit resolver — как определяется target wallet для priority communities (GLOBAL_COMMUNITY_ID routing).
3. Добавь условие: если `publication.sourceEntityType === 'project'`:
   - Permission check: caller = current lead of publication.sourceEntityId (НЕ caller === authorId)
   - После инвесторской логики: authorShare → ProjectDistributionService.distribute(sourceEntityId, authorShare)
   - Вместо стандартного зачисления на author wallet
4. Если sourceEntityType === undefined → стандартный flow без изменений
5. Добавь TODO: `// TODO: sourceEntityType === 'community' → Sprint 6`
6. Добавь тесты withdraw: пост с sourceEntityType='project' → authorShare в distribute; пост без sourceEntityType — без изменений; permission — только lead может withdraw проектный пост. См. SPRINT-3-PRD «Критические тесты».
7. Проверь билд. **Убедись что обычные посты (без sourceEntityType) работают как раньше!**

### Серия 4: publishToBirzha endpoint
1. Расширь project.router.ts:
   - `project.publishToBirzha` — protectedProcedure (lead only):
     1. Проверить caller = lead of projectId
     2. НЕ проверять permission rules Биржи (bypass POST_PUBLICATION)
     3. investorSharePercent: из input или project.investorSharePercent (дефолт). Валидировать в пределах birzha settings min/max.
     4. postCost = marathon-of-good settings.postCost. Debit из CommunityWallet.balance (atomic, ошибка если недостаточно)
     5. Создать publication: communityId=MARATHON_OF_GOOD_ID, authorId=caller, sourceEntityId=projectId, sourceEntityType='project', investorSharePercent (immutable), investingEnabled=(>0)
   - `project.getWallet` — protectedProcedure (member)
2. Добавь тесты publishToBirzha: postCost списывается при достаточном балансе; ошибка при недостатке; пост создаётся с sourceEntityId/Type; обход birzha permission для lead. См. SPRINT-3-PRD «Критические тесты».
3. Проверь билд

### Серия 5: Tappalka fallback
1. **Найди** сервис tappalka show-cost deduction (где списывается showCost за показ).
2. Добавь CommunityWallet как 3-й приоритет: после investmentPool и rating → если publication.sourceEntityId exists → попробовать CommunityWallet.debit (atomic $inc -showCost с условием balance >= showCost). Если fails → пост выходит из tappalka.
3. Проверь билд

### Серия 6: i18n + bugfix
1. Переименуй «Марафон Добра» → «Биржа Социальных Инвестиций» в i18n файлах
2. Найди диалог инвестирования: показывать total invested (не net после затрат)
3. Проверь билд

### Серия 7: Frontend
1. Создай PublishToBirzhaButton (lead only) + PublishToBirzhaDialog (контент, фото, investorSharePercent slider)
2. Создай ProjectWalletCard (баланс + «Пополнить»)
3. Создай ProjectPostBadge — метка «Проект» на карточке поста
4. Измени карточку поста в ленте: если sourceEntityId → показать название проекта вместо имени автора + ProjectPostBadge
5. Создай хуки: usePublishToBirzha, useProjectWallet
6. Проверь билд, напиши отчёт

## Формат отчёта

Единая структура: см. WORKFLOW.md — «Шаблон отчёта». Для Sprint 3 обязательны доп. блоки «Где перехвачен withdraw» и «Где merit resolver override» (см. ниже).

`docs/prd/projects/reports/SPRINT-3-REPORT.md`:

```markdown
# Sprint 3 Report

## Статус: ✅ / ⚠️ / ❌

## Что сделано
- [ ] Publication schema: +sourceEntityId, +sourceEntityType
- [ ] ProjectDistributionService (distribute с округлением, totalMerits=0 fallback)
- [ ] Withdraw flow перехвачен для sourceEntityType='project'
- [ ] Withdraw permission: lead of sourceEntityId (не authorId)
- [ ] publishToBirzha endpoint (bypass birzha permissions, postCost из CommunityWallet)
- [ ] Критические тесты: distribute, withdraw override, publishToBirzha (см. PRD)
- [ ] Tappalka: CommunityWallet как 3-й приоритет
- [ ] i18n: Марафон Добра → Биржа СИ
- [ ] Bugfix: investment dialog total
- [ ] Frontend: PublishToBirzhaButton/Dialog, ProjectWalletCard, ProjectPostBadge
- [ ] Карточка поста: проект вместо автора
- [ ] Билд проходит

## Где именно в коде перехвачен withdraw
- Файл: `...`
- Строка/метод: `...`
- Что изменено: `...`

## Где именно в коде merit resolver override
- Файл: `...`
- Что изменено: `...`

## CommunityWallet два потока — подтверждение
- [ ] balance меняется только при TopUp и operational debit (postCost, showCost)
- [ ] distribute НЕ трогает balance (только totalDistributed)

## Решения по ходу
## Не удалось
## Файлы

## Чеклист для проверки
- [ ] publishToBirzha → пост в MARATHON_OF_GOOD_ID с sourceEntityId
- [ ] postCost списан из CommunityWallet.balance
- [ ] Withdraw без инвесторов → распределение на личные кошельки
- [ ] Withdraw с инвесторами → инвесторы получают, потом распределение
- [ ] totalInternalMerits=0 → всё фаундеру
- [ ] CommunityWallet.balance НЕ меняется при distribute
- [ ] Обычные посты → withdraw работает как раньше (КРИТИЧЕСКИЙ ТЕСТ!)
- [ ] Tappalka: fallback на CommunityWallet работает
```

## Ключевые предупреждения
- **НЕ СЛОМАЙ** существующий withdraw flow. sourceEntityType=undefined → всё как раньше.
- CommunityWallet.balance = ТОЛЬКО операционные (TopUp). Транзитный поток = напрямую на кошельки, минуя balance.
- Три ID на посте: communityId (биржа), authorId (кто создал), sourceEntityId (проект). Документируй в коде.
