# AI Development Context — Meriter Project

> Этот документ — контекст для AI-ассистента (Claude) при работе над проектом.
> Обновлён: Январь 2026

---

## 1. О проекте

**Meriter** — merit-based социальная платформа, где пользователи зарабатывают и тратят "мериты" (внутреннюю валюту) для участия в активностях сообществ: создание публикаций, голосование за контент, комментарии, опросы.

### Стек технологий
- **Frontend**: React 19 + Next.js 16 + TypeScript + TanStack Query + tRPC + Tailwind + Zustand
- **Backend**: NestJS + TypeScript + tRPC + REST API
- **Database**: MongoDB 8 + Mongoose
- **Infrastructure**: pnpm monorepo, Docker Compose, Caddy reverse proxy, AWS S3/MinIO

### Структура репозитория
```
meriter-nextjs/
├── api/                    # Backend (NestJS) — @meriter/api
├── web/                    # Frontend (Next.js) — @meriter/web
├── libs/shared-types/      # Shared Zod schemas
├── .cursor/rules/          # AI правила для Cursor
└── docs/                   # Документация
```

---

## 2. Контекст разработки

### Режим работы
- **Фаза проекта**: MVP / быстрое прототипирование
- **Подход**: Pure AI-assisted development (vibe coding)
- **Ограничения**: Разработчик не знает React глубоко — полагается на AI
- **Будущее**: При выходе в прод будет нанята команда программистов

### Ключевые риски (из исследования)
- AI генерирует ~36% небезопасного кода (BaxBench)
- При ~100K строк кода продуктивность AI падает (Stanford research)
- "Vibe coding hangover" — накопление технического долга
- Без контекста AI ломает смежные системы

### Как митигируем риски
1. **Система правил** — `.cursor/rules/*.mdc` дают AI контекст проекта
2. **PRD-driven подход** — большие фичи начинаются с документа требований
3. **Итеративная работа** — маленькие шаги, частые коммиты
4. **Ручная проверка** — всегда смотреть diff перед Accept

---

## 3. Система правил Cursor

### Структура `.cursor/rules/`

| Файл | Тип | Назначение |
|------|-----|------------|
| `index.mdc` | Always | Master context — обзор проекта, структура, ключевые концепции |
| `business-logic.mdc` | Pattern | Бизнес-логика Merit системы, голосование, permissions |
| `architecture.mdc` | Pattern | Структура кода, куда что добавлять |
| `frontend.mdc` | Pattern | React/Next.js паттерны, компоненты, хуки |
| `backend.mdc` | Pattern | NestJS/tRPC паттерны, сервисы, роутеры |
| `local-dev-win.mdc` | Manual | Команды для Windows |
| `local-dev-linux.mdc` | Manual | Команды для Linux/macOS |
| `appversioning.mdc` | Always | Semantic versioning при изменениях |
| `buildcheck.mdc` | Always | Запуск тестов и билда после задач |
| `kiss.mdc` | Always | KISS/DRY/SOLID, проверка логики, no `any` |
| `pnpm.mdc` | Always | Использовать pnpm, lint перед коммитом |

### Принцип работы
- **Always Applied** — включены в каждый запрос
- **Pattern Matched** — включаются когда работаешь с файлами по glob-паттерну
- **Agent Decides** — AI сам решает по контексту
- **Manual** — включаются явно через `@ruleName`

---

## 4. Workflow разработки

### Для мелких задач (баг, правка)
```
Cmd+K → описание → проверка diff → Accept → pnpm lint → коммит
```

### Для больших фич
```
1. Создать PRD из docs/templates/PRD-TEMPLATE.md
2. Сохранить в docs/prd/[название-фичи].md
3. В Cursor Chat: @PRD + запрос на план
4. Создать feature branch
5. Реализация по шагам из плана
6. После каждого шага: проверка diff, lint, коммит
7. Тесты + билд
8. Merge
```

### Выбор инструмента Cursor
| Задача | Инструмент |
|--------|------------|
| 1-10 строк | Cmd+K |
| Один файл | Chat |
| Несколько файлов | Agent Mode |
| "Как работает X?" | Ask Mode |
| Планирование фичи | Ask Mode + PRD |

---

## 5. Ключевые правила кода

### API вызовы
- **Authenticated**: TanStack Query + tRPC
- **Unauthenticated**: TanStack Query + REST
- **Image uploads**: TanStack Query + REST с auth

### Расположение схем
- Shared (frontend + backend): `libs/shared-types/src/`
- Backend-only: `api/apps/meriter/src/common/schemas/`

### Naming conventions
- Файлы: kebab-case
- Компоненты: PascalCase
- Переменные: camelCase
- Routes: `getById`, `getAll`, `create`, `update`, `delete`

### Запреты
- ❌ `any` тип
- ❌ Пропуск TS ошибок
- ❌ Business logic в роутерах (только в сервисах)
- ❌ Permission checks в сервисах (только в роутерах)
- ❌ Прямой импорт из `api/` в `web/`

---

## 6. Бизнес-логика (кратко)

### Merit система
- **Quota** — ежедневные бесплатные мериты для голосования
- **Wallet** — накопленные мериты в сообществе

### Голосование
- Upvote: сначала quota, потом wallet
- Downvote: только wallet
- Self-vote: только wallet (currency constraint)

### Permissions
```
tRPC Router → PermissionService → PermissionContextService → PermissionRuleEngine
```
- Permission check = в роутере
- Business validation = в сервисе

---

## 7. Документация проекта

| Файл | Содержание |
|------|------------|
| `docs/CURSOR-WORKFLOW.md` | Как работать с Cursor |
| `docs/templates/PRD-TEMPLATE.md` | Шаблон для новых фич |
| `docs/LOCAL_SETUP.md` | Детальная инструкция по запуску |
| `ARCHITECTURE.md` | Архитектура (для человека) |
| `BUSINESS_LOGIC_DOCUMENTATION.md` | Полная бизнес-логика |
| `DEVELOPMENT.md` | Руководство разработчика |

---

## 8. Для Claude: как помогать

### При работе с этим проектом:
1. **Всегда учитывай контекст** из `.cursor/rules/` — там актуальные паттерны
2. **Следуй существующим паттернам** — смотри аналогичные файлы в проекте
3. **Маленькие шаги** — одна задача за раз, не переписывать всё сразу
4. **Проверяй смежные системы** — изменение в одном месте может сломать другое
5. **Предупреждай о рисках** — если видишь потенциальную проблему, скажи

### Чего НЕ делать:
- Не менять архитектурные решения без явного запроса
- Не добавлять новые зависимости без необходимости
- Не игнорировать TypeScript ошибки
- Не делать большие изменения в одном запросе

---

## 9. История решений

### Январь 2026: Внедрение AI workflow
- **Проблема**: ~100K строк кода, AI начал ломать смежные системы
- **Решение**: Создана система `.cursor/rules/*.mdc` с контекстом проекта
- **Результат**: 9 правил + шаблон PRD + workflow документация

### Источники best practices:
- Cursor Official Documentation (2025)
- Stanford Research: AI productivity at scale
- BaxBench Security Research
- Article: "How I Built a Production App with Claude Code"

---

*Этот документ обновляется при значительных изменениях в архитектуре или workflow.*