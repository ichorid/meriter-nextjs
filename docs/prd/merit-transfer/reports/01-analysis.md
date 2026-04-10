# Этап 0: Подготовка (анализ кодовой базы)

## Статус

✅ Завершён

## Что сделано

- **PREP-1**: ветка `feat/merit-transfer` создана от текущего `dev`.
- **PREP-2**: каталог `docs/prd/merit-transfer/reports/` создан; первый отчёт — этот файл.
- **PREP-2a**: прочитано ТЗ `docs/specs/Meriter_Передача_заслуг_v1.md` (первоисточник требований).
- **PREP-3**: зафиксированы файлы и паттерны для последующих этапов (см. ниже).
- **PREP-4**: изучены `merit-resolver.service.ts` и `wallet.service.ts`; выводы — в блоке «Merit-resolver и WalletService» и в **CHECK-результаты**.

## CHECK-результаты (из PRD «Cursor должен проверить в коде»)

### CHECK-1: merit-resolver и дебет при голосовании; quota vs wallet; transfer = wallet-only

- **`MeritResolverService`** (`api/apps/meriter/src/domain/services/merit-resolver.service.ts`): для операции `'voting'` возвращает `GLOBAL_COMMUNITY_ID` для приоритетных хабов и для **`isProject === true`**, иначе `community.id`; `'fee'` и `'withdrawal'` всегда глобальный кошелёк.
- **Дебет кошелька при голосовании** выполняется в **`createVoteLogic`** внутри `api/apps/meriter/src/trpc/routers/votes.router.ts` **после** `voteService.createVote`: при `walletAmount > 0` вызывается `ctx.walletService.addTransaction(..., 'debit', walletAmount, 'personal', 'publication_vote' | 'vote_vote', ...)`, где `communityId` для транзакции = `meritResolverService.getWalletCommunityId(community, 'voting')` (строки ~550–680).
- **Квота**: в том же `createVoteLogic` квота **не** списывается через `walletService` как отдельный debit; объём квоты в голосе задаётся полями `amountQuota` / `amountWallet` на документе `Vote`, остаток квоты считается агрегацией по голосам и коллекции `quota_usage` (см. хелперы в начале `votes.router.ts`). Для передачи заслуг по ТЗ/PRD нужен **только wallet** — путь через `walletService.addTransaction` с `sourceType: 'personal'`, без использования квоты.
- **Расширение для transfer**: в `MeritOperationType` сейчас нет отдельного типа под peer-transfer; для фичи потребуется добавить операцию (например `'transfer'`) и ветку в `getWalletCommunityId`, согласованную с маршрутизацией локальный/глобальный кошелёк из ТЗ (этап backend в тасклисте).

### CHECK-2: список участников (MembersList)

- Отдельного файла `MembersList.tsx` нет. Релевантные места:
  - **`web/src/components/organisms/Community/MembersTab.tsx`** — вкладка участников в настройках/контексте сообщества: `useCommunityMembers`, строки участников через **`MemberInfoCard`**, админские действия в `absolute right-2` (в т.ч. иконка `Coins` → **`AddMeritsDialog`**), только при `canRemoveMembers` (лид/суперадмин/`community.isAdmin`).
  - **`web/src/app/meriter/communities/[id]/members/CommunityMembersPageClient.tsx`** — полноценная страница `/meriter/communities/{id}/members`: **`MemberCardWithMerits`**, те же паттерны приглашения/удаления/начисления.
  - **`web/src/app/meriter/communities/[id]/members/MemberCardWithMerits.tsx`** — карточка с квотой/кошельком (для просмотра чужих меритов при правах).
- **`web/src/components/organisms/Project/ProjectMembersList.tsx`** — упрощённый список (текстовые строки, до 20), без кнопок; для кнопки «Передать заслуги» в проекте, вероятно, потребуется та же страница участников с `membersContext: 'project'` или расширение списка на странице проекта (уточнить при интеграции FE-5/FE-6).

### CHECK-3: админская «Начислить заслуги» (эмиссия)

- **API**: `wallets.addMeritsToUser` в `api/apps/meriter/src/trpc/routers/wallets.router.ts` — только superadmin или `communityService.isUserAdmin`; кредит в кошелёк: для приоритетного сообщества — `GLOBAL_COMMUNITY_ID`, иначе `input.communityId`; `referenceType: 'admin_add_merits'`.
- **UI**: **`web/src/components/organisms/Community/AddMeritsDialog.tsx`** — мутация `trpc.wallets.addMeritsToUser.useMutation()`.
- Вызов с UI: **`MembersTab`** и **`CommunityMembersPageClient`** — кнопка с иконкой монет (`Coins`), открывает диалог; на странице участников кнопки админского блока завязаны на права (лид/админ/суперадмин).
- **Конфликт с новой кнопкой**: логически не пересекается — эмиссия остаётся на `addMeritsToUser`, peer-transfer будет отдельный mutation/диалог; визуально разнести подписи/иконки (например отдельная кнопка «Передать» для всех участников рядом с карточкой, не только в admin-hover).

### CHECK-4: профиль пользователя — секции / табы

- **`web/src/app/meriter/profile/ProfileClient.tsx`**: одна склейная страница без shadcn-табов «входящие/исходящие»; секции: `ProfileHero`, `ProfileStats`, **`ProfileContentCards`** (публикации/комментарии/опросы/избранное), **`MeritsAndQuotaSection`**, затем списки сообществ/проектов через `CommunityCard`.
- Подразделы профиля вынесены в **отдельные маршруты**: `profile/publications`, `comments`, `polls`, `favorites`, `investments`, `projects` (каждый со своим `page.tsx` / `Client`).
- **Рекомендация для «Заслуги»**: добавить маршрут вида `web/src/app/meriter/profile/merit-transfers/page.tsx` (+ `Client`) с двумя вкладками и ссылку из `ProfileContentCards` или отдельный блок — по аналогии с `profile/investments`.

### CHECK-5: навигация сообщества/проекта — раздел «Переданные заслуги»

- На дашборде сообщества **`CommunityPageClient.tsx`** уже есть сетка ссылок-карточек (например `routes.communityMembers(chatId)`, `routes.communityProjects(chatId)` для не-МД).
- **Паттерн**: новый `Link` + маршрут в **`web/src/lib/constants/routes.ts`** (например `communityMeritTransfers: (id) => \`/meriter/communities/${id}/merit-transfers\``) и страница `app/meriter/communities/[id]/merit-transfers/page.tsx`.
- Для **проекта**: проверить layout страницы проекта (`web/src/app/meriter/projects/...` или вложенный community id) и добавить аналогичную ссылку в project dashboard, если отдельный от `CommunityPageClient` (этап FE-8).

## Merit-resolver и WalletService (PREP-4)

- **`WalletService.addTransaction`** (`wallet.service.ts`): единая точка credit/debit по `(userId, communityId)`; `sourceType`: `'personal' | 'quota'`; для передачи peer-to-peer ожидаются дебет отправителя и кредит получателя с `communityId`, согласованными с резолвером (и с ТЗ по global/local).
- **`wallets.transfer`** в роутере помечен как **NOT_IMPLEMENTED** — фича «передача заслуг» не должна опираться на него без реализации.
- Новая доменная операция должна явно **не** трогать коллекцию квоты как источник средств.

## Файлы, которые предстоит менять / добавлять (ориентир для этапов 1–4)

| Область | Пути |
|--------|------|
| Модель / сервис / роутер API | `api/apps/meriter/src/domain/models/...` (паттерн проекта — **models**, не `schemas/`), `merit-transfer.service.ts`, `merit-transfer.router.ts`, `domain.module.ts`, `trpc/router.ts` |
| Резолвер кошелька | `api/apps/meriter/src/domain/services/merit-resolver.service.ts` — расширить `MeritOperationType` и `getWalletCommunityId` для transfer |
| Shared contracts | `libs/shared-types/src/` — input/output Zod при необходимости |
| Список участников / эмиссия | `MembersTab.tsx`, `CommunityMembersPageClient.tsx`, при необходимости `MemberInfoCard`, `ProjectMembersList.tsx` или страница проекта |
| Навигация + лента | `routes.ts`, `CommunityPageClient.tsx`, новая страница ленты; зеркально для проекта |
| Профиль | новый подмаршрут под `profile/`, опционально правка `ProfileContentCards` |
| i18n | ключи под `pages.communities` / `profile` по мере добавления UI |

## Решения, принятые по ходу

- ⚠️ В PRD указан путь `domain/schemas/`; в репозитории Mongoose-схемы живут в **`domain/models/**`. Новую сущность класть по существующему паттерну (`*.schema.ts` рядом с моделью).
- ⚠️ `ProjectMembersList` сейчас не место для полноценных действий; уточнить продуктовый вход для FE-6 (полная страница участников проекта vs inline list).

## Не удалось / заблокировано

- Нет.

## Чеклист для проверки (человеком)

- [ ] Убедиться, что ветка `feat/merit-transfer` запушена/используется для последующих MR.
- [ ] Сверить с продуктом отображение передач для `isProject` (глобальный vs локальный кошелёк при голосовании уже особый случай в резолвере).
