# PRD: Спринт 3 — Публикация на Биржу и распределение

## Цель
Проект публикует результаты на Биржу СИ. При снятии меритов: инвесторская логика (существующая) → авторская доля → кооперативное распределение напрямую на личные кошельки (минуя CommunityWallet.balance).

## Контекст
- **Текущее**: `publications.withdraw` — автор снимает мериты на свой глобальный кошелёк.
- **Важно:** Для постов на бирже с `sourceEntityType='project'` при withdraw **authorShare** считается всегда от **authorId** (lead, создатель поста). Поле `beneficiaryId` для проектных постов на бирже не используется и не влияет на распределение (кооперативное распределение идёт по долям проекта, а не по бенефициару поста).
- С инвесторами: `withdrawAmount × contractPercent%` → инвесторам, остаток → автору. Merit resolver для priority communities направляет в GLOBAL_COMMUNITY_ID.
- **Ключевой инсайт**: мы НЕ меняем логику withdraw. Мы перехватываем routing авторской доли: вместо global wallet → ProjectDistributionService. Распределение минует CommunityWallet.balance (транзитный поток).
- **Зависит от**: Sprint 1 (кошелёк), Sprint 2 (внутренние доли).

## Требования

### Функциональные
- [ ] FR-1: Переименование «Марафон Добра» → «Биржа Социальных Инвестиций» (i18n, UI).
- [ ] FR-2: Публикация от проекта: пост в MARATHON_OF_GOOD_ID. `sourceEntityId = projectId`, `sourceEntityType = 'project'`. Отображается название + аватар проекта с меткой «Проект».
- [ ] FR-3: Кнопка «На биржу» (lead only). Диалог: контент, фото, investorSharePercent (дефолт из project.investorSharePercent, можно изменить в пределах birzha min/max). При публикации investorSharePercent копируется на publication (immutable contract).
- [ ] FR-4: **postCost при publishToBirzha: из CommunityWallet.balance проекта.** По тарифу биржи (marathon-of-good.settings.postCost). Если недостаточно → «Пополните кошелёк».
- [ ] FR-5: **publishToBirzha обходит permission rules Биржи** (POST_PUBLICATION может быть restricted). Проверяет только `caller = lead of project`. Применяет прочие валидации (контент, формат).
- [ ] FR-6: При withdraw/close с проектного поста: авторская доля → ProjectDistributionService → **напрямую на личные глобальные кошельки** (не через CommunityWallet.balance). CommunityWallet.totalDistributed += amount.
- [ ] FR-7: Кооперативное распределение:
  - Если `totalInternalMerits == 0` → **100% authorShare → фаундеру** (одно действие, формула не применяется)
  - Иначе: `founderFixed = authorShare × founderSharePercent%` → фаундеру; `teamPool = authorShare - founderFixed` → участникам пропорционально внутренним долям (фаундер тоже в командной части)
- [ ] FR-8: Оплата показов в майнинге из кошелька проекта. Приоритет: investmentPool → rating → CommunityWallet.balance.
- [ ] FR-9: TopUp кошелька: любой участник переводит из личного. UI: «Это донат, не инвестиция, возврат не предусмотрен.»
- [ ] FR-10: Багфикс: в диалоге инвестирования показывать полную сумму вложенных (total invested), не net.

### Технические
- [ ] TR-1: Расширить PublicationSchema: `sourceEntityId`, `sourceEntityType` (enum ['project','community'], default undefined).
- [ ] TR-2: **КРИТИЧЕСКОЕ**: Переопределить merit resolver routing: для sourceEntityType='project' авторская доля при withdraw → ProjectDistributionService → прямое распределение на личные кошельки (минуя CommunityWallet.balance и global wallet).
- [ ] TR-3: **КРИТИЧЕСКОЕ**: Withdraw permission: если sourceEntityType='project' → `caller = current lead of sourceEntityId` (НЕ стандартный `caller === authorId`). `// TODO: multiple leads support`.
- [ ] TR-4: Создать ProjectDistributionService: distribute(projectId, amount).
- [ ] TR-5: publishToBirzha: прямое создание publication в MARATHON_OF_GOOD_ID, bypass birzha POST_PUBLICATION permission, debit postCost из CommunityWallet.
- [ ] TR-6: Tappalka show-cost: добавить CommunityWallet как 3-й приоритет. Atomic `$inc: -showCost` с условием `balance >= showCost`.
- [ ] TR-7: Frontend: кнопка + диалог, карточка проекта на бирже, TopUp dialog, bagfix инвестиций.

### Cursor должен проверить в коде
- [ ] CHECK-1: Найти ТОЧНОЕ место в withdraw flow где authorShare зачисляется. Добавить условие по sourceEntityType.
- [ ] CHECK-2: Найти merit resolver. Понять routing для priority communities. Добавить override.
- [ ] CHECK-3: Найти tappalka show-cost deduction service. Добавить CommunityWallet fallback.

### Критические тесты (добавить в Sprint 3)
- [ ] **ProjectDistributionService:** тест при totalInternalMerits=0 (всё фаундеру); тест при totalInternalMerits>0 (формула, округление, остаток фаундеру, balance не трогается, totalDistributed растёт).
- [ ] **Withdraw:** тест для поста с sourceEntityType='project' — authorShare идёт в distribute, не на кошелёк автора; тест для поста без sourceEntityType — без изменений. Тест permission: withdraw проектного поста разрешён только lead проекта.
- [ ] **publishToBirzha:** тест списания postCost с CommunityWallet при достаточном балансе; тест ошибки при недостаточном балансе; тест создания поста с sourceEntityId/sourceEntityType и обхода birzha POST_PUBLICATION для lead.

## Детали реализации

### Backend

**Новые сервисы:**
- `domain/services/project-distribution.service.ts`
  - `distribute(projectId, authorShare)`:
    1. Получить project (founderSharePercent, founderUserId)
    2. `totalInternalMerits = getProjectShares(projectId).total`
    3. Если `totalInternalMerits == 0` → всё фаундеру одним действием. Return.
    4. `founderFixed = authorShare × founderSharePercent / 100`
    5. `teamPool = authorShare - founderFixed`
    6. Для каждого участника (вкл. фаундера): `share = teamPool × (participantMerits / totalInternalMerits)` → deposit на глобальный кошелёк
    7. Фаундер итого = founderFixed + founderTeamShare
    8. **Округление:** каждую долю округлять до 2 знаков после запятой (например, `Math.floor(share * 100) / 100`). Остаток = `authorShare - sum(округлённых долей)` → зачислить фаундеру (гарантирует отсутствие потерь).
    9. `CommunityWallet.totalDistributed += authorShare` (balance НЕ трогаем)

**Изменяемые сервисы:**
- Withdraw flow: после инвесторской логики, если `sourceEntityType = 'project'`:
  - Вместо `authorShare → author global wallet` → `ProjectDistributionService.distribute(sourceEntityId, authorShare)`
  - Если `sourceEntityType = undefined` → стандартно (ничего не меняем)
- Withdraw permission: если `sourceEntityType = 'project'` → `caller = current lead of sourceEntityId`
- Tappalka show-cost: 3-й fallback → CommunityWallet (если sourceEntityId на publication)

**Роутеры:**
- Расширить `project.router.ts`:
  ```
  project.publishToBirzha  — protectedProcedure (lead)
  project.getWallet        — protectedProcedure (member)
  ```

**Три ID на проектном посте (документировать в коде):**
```
publication.communityId        = MARATHON_OF_GOOD_ID (где опубликован)
publication.authorId           = userId админа (кто создал)
publication.sourceEntityId     = projectCommunityId (проект-источник)
publication.sourceEntityType   = 'project'
project.parentCommunityId      = родительское сообщество
```

### Frontend

**Новые компоненты:**
- `components/organisms/Project/PublishToBirzhaButton.tsx` — (lead only)
- `components/organisms/Project/PublishToBirzhaDialog.tsx` — контент, фото, investorSharePercent (slider), preview
- `components/organisms/Project/ProjectWalletCard.tsx` — баланс + «Пополнить»
- `components/molecules/ProjectPostBadge.tsx` — метка «Проект»

**Изменяемые:**
- Карточка поста в ленте: если sourceEntityId → ProjectPostBadge, название проекта
- Диалог инвестирования: total invested (не net) — багфикс

**Хуки:**
- `hooks/api/useProjectPublish.ts`: usePublishToBirzha
- Расширить useProjects.ts: useProjectWallet

## CommunityWallet — два потока (важно для реализации)

```
CommunityWallet.balance = ТОЛЬКО операционные средства (TopUp).
Расходуется на: postCost publishToBirzha, tappalka showCost.
Пополняется через: TopUp (донат участников).

Транзитный поток (распределение при withdraw):
НЕ проходит через balance.
ProjectDistributionService зачисляет напрямую на личные кошельки.
CommunityWallet.totalDistributed += amount (учёт, не баланс).
```

## Acceptance Criteria
- [ ] AC-1: publishToBirzha → пост в MARATHON_OF_GOOD_ID с sourceEntityId/Type, метка «Проект»
- [ ] AC-2: postCost списан из CommunityWallet.balance
- [ ] AC-3: Withdraw без инвесторов: authorShare → distribution → на личные кошельки
- [ ] AC-4: Withdraw с инвесторами 20%: 20% инвесторам, 80% → distribution
- [ ] AC-5: totalInternalMerits=0 → всё фаундеру
- [ ] AC-6: founderShare=15%, Маша=40% внутренних → фаундер получает 15% + (85%×founderInternal%)
- [ ] AC-7: TopUp: +100 → CommunityWallet.balance = 100
- [ ] AC-8: Tappalka: pool=0, rating=0 → showCost из CommunityWallet
- [ ] AC-9: Обычные посты (sourceEntityType=undefined) → withdraw стандартно
- [ ] AC-10: CommunityWallet.balance НЕ меняется при distribute (только totalDistributed)

## Sprint 6 — community as Birzha source (cross-ref)

Non-project local communities can publish to Birzha via `communities.publishToBirzha`; shared UI/hooks, `publications.topUpRating` (personal vs source CommunityWallet), withdraw to CommunityWallet for `sourceEntityType === 'community'` on МД. See `docs/prd/PRD-BIRZHA-SOURCE-ENTITY.md` and migration `api/scripts/migrate-birzha-publication-author-fields.ts`.

## Связанные файлы
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — withdraw procedure
- `api/apps/meriter/src/domain/services/wallet.service.ts` — wallet operations
- `api/apps/meriter/src/domain/services/` — investment/post-closing services
- `api/apps/meriter/src/domain/services/` — tappalka show-cost
- `api/apps/meriter/src/domain/common/helpers/` — priority community / merit resolver
- Всё из Sprints 1-2
