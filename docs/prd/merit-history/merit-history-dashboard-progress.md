# Progress: Merit History Dashboard

Статус: **готово** (реализация по `merit-history-dashboard-prd.md`).

| Дата | Фаза | Сделано |
|------|------|--------|
| 2026-04-21 | Backend | `buildMeritHistoryTransactionMatch`, `meritHistoryUtcCalendarRange`, signed/category Mongo helpers; `WalletService.getMeritHistoryDashboard`; `wallets.getMeritHistoryDashboard`; индекс `walletId`+`createdAt`; unit-тесты хелперов |
| 2026-04-21 | Web | `MeritHistoryDashboardPanel` (KPI, период 7/30/90, SVG sparkline, таблица на «Все»); wiring в profile merit-transfers и user merit-history; i18n en/ru |
| 2026-04-21 | Docs/rules | `business-merit-history.mdc` синхронизирован с кодом |
