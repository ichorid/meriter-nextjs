# Pilot Multi-Obraz: dismissible welcome banner (TZ)

## Goal

The large welcome `section` on the pilot home is shown **until the user dismisses it once**. After dismiss, it **must not reappear** for that browser profile (persist `localStorage`).

## UX

1. **Close control**: icon button (X), top-right of the welcome panel, accessible name via i18n.
2. **After dismiss**:
   - **Primary CTA** (“Помечтать” / login for guests) moves to the **same row as “Лента мечт”**: title left, button right; **single row on mobile** (`flex-nowrap`, title `truncate`, button `shrink-0`).
   - **“О Мериттерре”** moves to the **top merits row** (same strip as quota/wallet), **to the left** of the quota block, **outline/secondary** (not primary).
3. **Lore dialog**: same behavior as today (fetch `/api/pilot/lore`), available from the welcome panel **or** from the header “О Мериттерре” after dismiss.

## Technical

- Storage key: `meriter.pilotMultiObraz.welcomeDismissed` = `'1'`.
- Hydration: read `localStorage` in `useLayoutEffect` after first paint aligned with SSR (initial `false`).
- Shared UI: `PilotObrazUiProvider` wraps `MultiObrazPilotChrome` so **PilotMeritsLine** and **PilotMultiObrazHomeClient** share dismiss + `openLore`.

## Out of scope

- Server-side persistence of dismiss.
- Changing non-pilot layouts.
