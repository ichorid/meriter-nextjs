# Session 00 — Preflight & Regression (post-3f0bb88e)

| | |
|---|---|
| **Priority** | P0 — блокирует prod |
| **Env** | dev.meriter.pro или local |
| **Role** | Fake superadmin |
| **Viewport** | Desktop 1280×800 + Mobile 390×844 |

## Preconditions

- [ ] Login page доступен
- [ ] Видны кнопки Fake user / Fake superadmin (dev mode)
- [ ] Ветка содержит fix QA (`3f0bb88e` или новее)

## Steps

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 0.1 | Open `/meriter/login` | Страница загружается; поле email; **нет** Telegram widget | | |
| 0.2 | DevTools Console on login | Нет красных 500; нет «Bot domain invalid» | | |
| 0.3 | Click **Fake superadmin** | Успешный вход; redirect на profile или returnTo | | |
| 0.4 | Desktop: открыть sidebar (lg) | Primary nav: Образы, Биржа, Проекты; секции сообществ внизу | | |
| 0.5 | Settings → **Create fake community** | Success message; redirect на community | | |
| 0.6 | Вернуться на hub; sidebar | Test community в **«Администрируемые сообщества»** | | |
| 0.7 | Settings → **Add to all communities** | Success; sidebar **без** full page reload показывает данные | | |
| 0.8 | Sidebar: секция «другие сообщества» | МД **не** дублируется здесь (МД только в top nav «Биржа») — это OK | | |
| 0.9 | Mobile 390px: About → Platform settings dialog | Кнопка **Seed demo world** видна **без скролла** | | |
| 0.10 | МД hub → Создать → **Создать пост** | URL `…/create`; форма открывается | | |
| 0.11 | `/create`: пустая форма | **Нет** баннера «Черновик восстановлен»; счётчик **0/5000** | | |
| 0.12 | Console on `/create` | **Нет** `[tiptap warn]: Duplicate extension names` | | |
| 0.13 | Console on любой странице | **Нет** Next warning про `scroll-behavior` без `data-scroll-behavior` | | |
| 0.14 | МД: создать пост → голос за **свой** пост | Popup: «за свой **пост**» (RU), не «проект» | | |

## Regression scope (commits)

- Telegram disabled
- Sidebar membership fallback
- Draft key scoped by user
- TipTap extensions
- CreateMenu navigation
- PlatformDev mobile visibility
- Self-vote i18n

## Session result

- [ ] **PASS** — все P/F = P  
- [ ] **PARTIAL** — только Minor fails  
- [ ] **FAIL** — любой Blocker/Critical  

## Fail log

| ID | Severity | Summary | URL | Screenshot |
|----|----------|---------|-----|------------|
| | Blocker / Critical / Major / Minor | | | |

## Agent notes

Autonomous: no user input. Run desktop + mobile for 0.9. Snapshot sidebar after 0.6.
