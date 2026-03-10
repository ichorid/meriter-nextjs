# Sprint 5 Report

## Status
✅ Completed

## Context from Sprint 4 (reconnaissance)

- **Membership model:** `UserCommunityRole` (collection `user_community_roles`), roles `lead` | `participant`. See SPRINT-4-REPORT.md.
- **frozenInternalMerits:** On `UserCommunityRole`; set on leave; total included in `getProjectShares` denominator. See SPRINT-4-REPORT.md.
- **closeProject → publications.close:** `project.service.closeProject` finds Birzha posts with `sourceEntityType='project'`, `sourceEntityId=projectId`, and calls `postClosingService.closePost(id, 'manual')` for each; then sets `projectStatus='archived'`. See SPRINT-4-REPORT.md.

## What was done

- [x] **Neutral tickets (backend):** `ticket.service.ts`: `createNeutralTicket` (postType='ticket', isNeutralTicket=true, beneficiaryId=null, ticketStatus='open', applicants=[]); `applyForTicket` (add to applicants[], notify lead with `ticket_apply`); `approveApplicant` (lead check, auto-join if not member, set beneficiaryId/ticketStatus='in_progress'/isNeutralTicket=false, clear applicants, notify approved + `ticket_rejection` for rest with project `rejectionMessage` or default); `rejectApplicant` (remove from applicants[], send `ticket_rejection`); `getOpenNeutralTickets(projectId)` (public: id, title, description only); `getApplicants(ticketId, leadUserId)`.
- [x] **ticket.router.ts:** `createNeutral`, `apply`, `approve`, `reject`, `getApplicants` (all protected; createNeutral/approve/reject/getApplicants lead-checked in service).
- [x] **project.getOpenTickets:** `publicProcedure`, input `projectId`, returns open neutral tickets (id, title, description).
- [x] **Beneficiary in ordinary posts:** `publication.service.ts` — on create, optional `dto.beneficiaryId`; validated as registered user via `userService.getUserById`; set on publication (immutable). Withdraw already uses effective beneficiary (`getEffectiveBeneficiary` → beneficiaryId ?? authorId); no change needed.
- [x] **transferAdmin:** `project.service.transferAdmin(projectId, currentLeadId, newLeadId)`: checks current user is lead, new lead is member, swaps roles (current→participant, new→lead) via `userCommunityRoleService.setRole(..., true)`; **founderUserId not updated**; notifies all members (`shares_changed` with metadata transferAdmin/newLeadId/previousLeadId). `project.transferAdmin` in project.router (protected).
- [x] **Withdraw after transferAdmin:** Permission for project posts is by **sourceEntityId** (project): `role?.role !== 'lead'` on that project. After transfer, the new lead has role `lead` on the project, so the new lead **can** call withdraw on existing project posts. Confirmed in `publications.router.ts` withdraw branch for `sourceEntityType === 'project'`.
- [x] **Notifications:** Added types `ticket_apply`, `ticket_rejection` to notification schema and web types; icons in NotificationsClient.
- [x] **Frontend:** `NeutralTicketPublicCard` (title, description, "I'll take it" with apply); `ApplicantsPanel` (lead: list applicants, approve/reject); `TransferAdminDialog` (select member as new lead); `BeneficiarySelector` (search user, select for publication); ProjectCard section "Open tasks" (getOpenTickets, list public cards, apply); PublicationCreateForm optional Beneficiary (BeneficiarySelector when !isProjectCommunity); Project settings: "Transfer admin" button + dialog; CreateNeutralTicketForm + "Open task" in ProjectTabs; TicketCard shows ApplicantsPanel for lead when open neutral ticket. Hooks: `useOpenTickets`, `useTransferAdmin`, `useCreateNeutralTicket`, `useApplyForTicket`, `useGetApplicants`, `useApproveApplicant`, `useRejectApplicant`.
- [x] Build passes (api + web).

## Decisions made along the way

- **Notification types:** Added `ticket_apply` and `ticket_rejection` in Series 1 (backend) so ticket.service could send them; frontend types and icons added in same sprint.
- **transferAdmin notification:** Reused `shares_changed` with metadata `transferAdmin: true`, `newLeadId`, `previousLeadId` to avoid adding a new notification type; message text is "Project admin transferred".
- **BeneficiarySelector:** Uses existing `users.searchUsers` (min 2 chars); selected user label via `useUserProfile(value)`.

## Not done / blocked

- None.

## Files created or modified

**Backend**
- `api/apps/meriter/src/domain/models/notification/notification.schema.ts` — ticket_apply, ticket_rejection.
- `api/apps/meriter/src/domain/services/ticket.service.ts` — createNeutralTicket, applyForTicket, approveApplicant, rejectApplicant, getApplicants, getOpenNeutralTickets; UserService injected for auto-join.
- `api/apps/meriter/src/domain/services/publication.service.ts` — optional beneficiaryId validation (registered user); UserService injected.
- `api/apps/meriter/src/domain/services/project.service.ts` — transferAdmin.
- `api/apps/meriter/src/trpc/routers/ticket.router.ts` — createNeutral, apply, approve, reject, getApplicants.
- `api/apps/meriter/src/trpc/routers/project.router.ts` — getOpenTickets, transferAdmin.

**Frontend**
- `web/src/types/api-v1/index.ts` — NotificationType: ticket_apply, ticket_rejection.
- `web/src/hooks/api/useProjects.ts` — useOpenTickets, useTransferAdmin.
- `web/src/hooks/api/useTickets.ts` — useCreateNeutralTicket, useApplyForTicket, useGetApplicants, useApproveApplicant, useRejectApplicant.
- `web/src/components/organisms/Project/NeutralTicketPublicCard.tsx` — new.
- `web/src/components/organisms/Project/ApplicantsPanel.tsx` — new.
- `web/src/components/organisms/Project/TransferAdminDialog.tsx` — new.
- `web/src/components/organisms/Project/CreateNeutralTicketForm.tsx` — new.
- `web/src/components/molecules/BeneficiarySelector.tsx` — new.
- `web/src/components/organisms/Project/ProjectCard.tsx` — Open tasks section, useOpenTickets, NeutralTicketPublicCard, useApplyForTicket.
- `web/src/components/organisms/Project/TicketCard.tsx` — isOpenNeutral, ApplicantsPanel for lead.
- `web/src/components/organisms/Project/ProjectTabs.tsx` — CreateNeutralTicketForm dialog, "Open task" button.
- `web/src/app/meriter/projects/[id]/ProjectPageClient.tsx` — Transfer admin button, TransferAdminDialog.
- `web/src/features/publications/components/PublicationCreateForm.tsx` — BeneficiarySelector, beneficiaryId state and payload.
- `web/src/app/meriter/notifications/NotificationsClient.tsx` — Icons for ticket_apply, ticket_rejection.

## Checklist for manual verification

- [ ] Lead creates neutral ticket → appears as open task on project card; anyone authenticated can click "I'll take it" and apply.
- [ ] Lead sees applicants on open neutral ticket; approve → applicant joins project, becomes beneficiary, ticket in_progress; reject → applicant gets notification (rejectionMessage or default).
- [ ] Ordinary post with beneficiary: create with BeneficiarySelector; withdraw credits beneficiary.
- [ ] Lead transfers admin to another member → roles swap, founderUserId unchanged; new lead can withdraw from project posts on Birzha.
- [ ] Notifications: ticket_apply (lead), ticket_rejection (applicant) show correct icon and message.
