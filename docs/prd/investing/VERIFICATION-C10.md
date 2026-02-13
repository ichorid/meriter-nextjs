# C-10 Notifications & Final Verification

## C-10: Notification wiring (all present from previous tasks)

| Event | Recipient | Location | Type |
|-------|-----------|----------|------|
| New investment | Post author | `InvestmentService.processInvestment()` | `investment_received` |
| Withdrawal with distribution | Each investor (amount > 0) | `InvestmentService.distributeOnWithdrawal()` | `investment_distributed` |
| Investment pool depleted | Post author | `TappalkaService.deductShowCost()` (after pool used, remainingCost > 0) | `investment_pool_depleted` |
| Post exited tappalka | Post author | `TappalkaService.deductShowCost()` (noAuthorWalletSpend, no funds) | `investment_pool_depleted` |

Redirect URLs for these types are handled in `NotificationService.buildRedirectUrl()` (link to post).

---

## Edge cases verified

- **Invest 0:** Rejected by tRPC input schema `z.number().int().min(1)` and by `InvestmentService.processInvestment()` (`amount <= 0` → BadRequest).
- **Single investor:** Gets 100% of investor portion; `authorAmount = withdrawAmount - distributedTotal`.
- **Investor share rounds to &lt; 0.01:** Only entries with `amount > 0` are added to `investorDistributions` and notified; remainder stays with author.
- **investmentPool 0.05, show cost 0.1:** Pool deducts 0.05, `remainingCost = 0.05`; then rating or author wallet is used for the rest; pool-depleted notification sent when applicable.

---

## Files created/modified in Feature C (Investments v1)

### Backend (api/)
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — C-1
- `api/apps/meriter/src/domain/services/investment.service.ts` — C-2, C-3, C-4, C-10
- `api/apps/meriter/src/domain/services/tappalka.service.ts` — C-5, C-10
- `api/apps/meriter/src/trpc/routers/investment.router.ts` — C-2, C-3

### Frontend (web/)
- `web/src/components/organisms/InvestDialog/InvestDialog.tsx` — C-6
- `web/src/components/organisms/InvestButton/InvestButton.tsx` — (unchanged props)
- `web/src/components/organisms/InvestmentBreakdownPopup/InvestmentBreakdownPopup.tsx` — C-8 (new)
- `web/src/components/organisms/InvestmentBreakdownPopup/index.ts` — C-8 (new)
- `web/src/components/organisms/Publication/PublicationActions.tsx` — C-7, C-8
- `web/src/components/organisms/WithdrawPopup/WithdrawPopup.tsx` — C-9
- `web/src/components/organisms/WithdrawPopup/WithdrawPopupContent.tsx` — C-9
- `web/src/hooks/api/useInvestments.ts` — C-6 (invalidate getInvestmentBreakdown)
- `web/messages/en.json` — C-6, C-7, C-8, C-9
- `web/messages/ru.json` — C-6, C-7, C-8, C-9

### Docs
- `docs/prd/investing/IMPLEMENTATION-PLAN-C-investments-v1.md` — (pre-existing)
- `docs/prd/investing/VERIFICATION-C10.md` — (this file)
