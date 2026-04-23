# Changelog

All notable changes to this monorepo are recorded here. Package versions for release images come from `web/package.json` (`@meriter/web`) and `api/package.json` (`@meriter/api`); see `.cursor/rules/appversioning.mdc`.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style: **Added** / **Changed** / **Fixed** / **Security** where applicable.

## [Unreleased]

Nothing yet.

## [web 0.48.39] [api 0.48.5] - 2026-04-23

### Changed (Events — public schedule, RSVP via membership, attendance, QR)

**Product**

- Event lists (`getEventsByCommunity`) are available to any **authenticated** user; membership is no longer required to **view** upcoming/past events for a team or project.
- RSVP (“I'll attend”) requires **community/project membership**. Non-members get a dialog to submit a **join request** (or project join) with an auto-generated note and optional `pendingEventPublicationId`; on **approval**, RSVP is applied automatically.
- **Invite links** no longer add users to the attendee list without membership. Invite landing shows preview and directs users to join the team/project first; `getInvitePreview` includes **`isProject`** for correct navigation.
- **Attendance**: event author or community **lead** can set **present** / **absent** (manual) or scan a participant **check-in QR** (`issueMyCheckInToken`, `checkInByToken`). RSVP and participant QR are **locked** after the event starts (effective start) or once attendance is set for that user.
- **Merit transfers** with `eventPostId` require the receiver to be a **member** of the context (no invite-only global bypass).

**Technical**

- Publications: `eventParticipants` subdocuments (with legacy `eventAttendees` kept in sync for compatibility).
- tRPC: `events.issueMyCheckInToken`, `events.checkInByToken`, `events.setParticipantAttendance`; relaxed gate on `getEventsByCommunity`.
- Web: `EventRSVP`, `EventPage`, `EventsFeed`, `EventCard`, `EventInviteLanding`, check-in dialogs; community/project dashboard links to Events for all logged-in users; RU/EN strings under `events.*`.

**Docs**

- PRD and agent brief live under `docs/prd/events/` (`agent-brief.md`, `public-rsvp-attendance-prd.md`). Cursor rules: `business-events.mdc`, `business-merit-transfer.mdc`.
