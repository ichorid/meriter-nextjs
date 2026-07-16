# Feature Coverage Matrix

Отметка **Session** = ручной кейс есть в соответствующем файле.  
**Auto** = дополнительно покрыто `pnpm test` (не заменяет browser).

| Feature / Route | Session | P | Notes |
|-----------------|---------|---|-------|
| **Auth** | | | |
| Login email UI | 01, 12 | P0 | Telegram SKIP |
| Fake user / superadmin | 00, agent-setup | P0 | dev only |
| Logout | 01 | P0 | |
| Welcome `/meriter/welcome` | 01 | P1 | new user path |
| Link account `/meriter/welcome/link-account` | 01 | P1 | email link, no Telegram |
| New user `/meriter/new-user` | 01 | P2 | if routed |
| OAuth callback | 12 | P3 | if enabled on env |
| Passkey | 12 | P3 | manual WebAuthn |
| SMS / phone call-check | 12 | P3 | needs phone |
| **Navigation & layout** | | | |
| Desktop sidebar | 00, 02 | P0 | communities lists |
| Mobile bottom bar (5 tabs) | 02 | P0 | |
| CreateMenu / FAB | 00, 02 | P0 | |
| 404 `/meriter/not-found` | 02 | P2 | |
| **Settings & chrome** | | | |
| Language RU/EN | 01 | P1 | |
| Theme dark/light | 01 | P1 | |
| Settings dev tools | 00, 03 | P0 | fake community |
| About + platform admin dialog | 00, 01 | P1 | seed demo |
| **Priority hubs** | | | |
| Future Visions `/future-visions` | 02, 05 | P0 | |
| МД / Биржа community feed | 02, 04, 05 | P0 | |
| Projects hub `/projects` | 02, 07 | P0 | |
| Feedback/support hub | 02 | P2 | if exists in env |
| **Communities** | | | |
| List `/communities` | 03 | P1 | |
| Create community | 03 | P1 | |
| Community feed + tabs | 03, 04 | P0 | |
| Settings (all tabs) | 03 | P1 | permissions, tappalka, investing |
| Rules page | 03 | P2 | |
| Members list / roles | 03 | P1 | |
| Remove member | 03 | P2 | lead only |
| Join `/join/[token]` | 03 | P1 | |
| Legacy invite URL | 03 | P2 | |
| Leave community (team) | 03 | P2 | not priority hubs |
| Community projects tab | 03, 07 | P1 | |
| Deleted community view | 03 | P2 | |
| **Publications** | | | |
| Create post | 00, 04 | P0 | |
| Rich text / images | 04 | P1 | no TipTap dup warn |
| Draft save/restore/clear | 00, 04 | P0 | user-scoped key |
| Edit publication | 04 | P1 | |
| Post detail page | 04, 05 | P0 | |
| Close post (manual) | 04 | P1 | negative_rating |
| Restore / permanent delete | 04 | P2 | lead/author |
| Withdraw from post rating | 04, 05 | P1 | allowWithdraw |
| Publish as community (Birzha) | 04, 07 | P1 | actingAsCommunityId |
| Project discussion post | 07 | P1 | postType discussion |
| **Voting & comments** | | | |
| Upvote quota→wallet | 05 | P0 | |
| Downvote wallet only | 05 | P1 | |
| Self-vote wallet + copy | 00, 05 | P0 | «за свой пост» |
| Comment modes weighted/neutral | 05 | P2 | МД investing posts |
| Withdraw from vote score | 05 | P2 | |
| **Polls** | | | |
| Create poll | 05 | P1 | not in ОБ |
| Cast poll | 05 | P1 | |
| Edit poll | 05 | P2 | |
| ОБ polls blocked | 05 | P1 | empty/blocked |
| **Documents** | | | |
| Documents hub | 06 | P1 | |
| Document canvas / blocks | 06 | P1 | |
| Propose variant | 06 | P1 | |
| Proposal rail (no duplicates) | 06 | P0 | fix 0b30d46f |
| Vote variant | 06 | P0 | |
| Close wave / apply | 06 | P1 | |
| Deep link `#block-` | 06 | P2 | |
| **Projects & Birzha** | | | |
| Create cooperative project | 07 | P1 | |
| Project dashboard tabs | 07 | P1 | |
| Tickets CRUD + lifecycle | 07 | P1 | assign/done/accept |
| Birzha publish (project) | 07 | P1 | |
| Birzha publish (community) | 07 | P1 | |
| Birzha-posts lists | 07 | P1 | |
| CommunityWallet / withdraw source | 07 | P2 | |
| Project close / distribution | 07 | P2 | |
| **Tappalka** | | | |
| Open modal / onboarding | 08 | P1 | |
| Comparison pair | 08 | P1 | |
| Progress 10→1 merit | 08 | P1 | |
| ?tappalka=1 deep link | 08 | P2 | |
| **Events & transfers** | | | |
| Events hub community/project | 09 | P2 | |
| Create event | 09 | P2 | |
| RSVP | 09 | P2 | |
| Event invite token | 09 | P2 | |
| Event page (no vote/forward) | 09 | P2 | |
| P2P merit transfer | 09 | P2 | |
| Merit transfer feeds | 09, 11 | P2 | |
| **Investing & forward** | | | |
| Post with investing | 10 | P2 | МД |
| Invest / pool / close distribute | 10 | P2 | |
| proposeForward (team) | 10 | P2 | |
| Lead forward / reject forward | 10 | P2 | |
| **Profile & discovery** | | | |
| Profile hero / edit | 11 | P1 | |
| Profile publications/comments/polls | 11 | P1 | |
| Profile favorites | 11 | P1 | |
| Profile investments | 11 | P2 | |
| Profile merit transfers | 11 | P2 | |
| Merit history (user/community/project) | 11 | P1 | |
| Public user profile `/users/[id]` | 11 | P1 | |
| Search `/search` | 11 | P1 | |
| Notifications list + read | 11 | P1 | |
| Linked providers (no Telegram) | 01, 11 | P1 | |
| **Prod** | | | |
| Prod login + hubs read-only | 13 | P0 | explicit OK |

## Known non-goals (do not fail QA for)

- `wallets.withdraw` / `wallets.transfer` tRPC — NOT_IMPLEMENTED
- Auto quota reset at UTC midnight — cron; spot-check only
- Document wave cron auto-apply — unless seed triggers wave end
- Telegram login/link — disabled by policy
- Platform wipe/seed on prod — forbidden in session 13

## Unit test overlap (Auto)

- Document proposal diff/rail logic — `web/src/features/documents/**/*.test.ts`
- Login form Telegram policy — `LoginForm.test.tsx`
- API domain — `pnpm --filter @meriter/api test`

Browser QA still required for integration and UX.
