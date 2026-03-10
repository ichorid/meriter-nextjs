# Sprint 4 Report

## Status
✅ Completed

## What was done

- [x] **Membership model:** Identified `UserCommunityRole` (collection `user_community_roles`). Added `frozenInternalMerits: { type: Number, default: 0 }` to the schema.
- [x] **getProjectShares:** Total now includes `frozenInternalMerits` of left members (via `UserCommunityRoleService.getTotalFrozenInternalMerits`). `ProjectDistributionService.distribute` uses `totalActive + totalFrozen` for the denominator.
- [x] **closeProject(projectId, leadUserId):** Implemented in `project.service.ts`. Checks lead, projectStatus='active'; finds active publications on Birzha (marathon-of-good) with sourceEntityType='project', sourceEntityId=projectId; calls `postClosingService.closePost(id, 'manual')` for each; sets projectStatus='archived'; notifies all members with `project_closed`.
- [x] **PostClosingService:** For posts with `sourceEntityType === 'project'` and `sourceEntityId`, author share on close is sent to `projectDistributionService.distribute(sourceEntityId, authorAmount)` instead of wallet credit. **Confirmation:** `publications.close` → `postClosingService.closePost` → investment split → author share path: project branch calls `ProjectDistributionService.distribute`; thus auto-withdraw on close goes through ProjectDistributionService.
- [x] **Permission check:** In `permission.service.ts`, `canCreatePublication`, `canCreatePoll`, and `canVote` return false when community is project and `projectStatus === 'archived'`.
- [x] **closeProject integration test:** `project-close-project.spec.ts` — project with post on Birzha (sourceEntityType='project') → closeProject as lead → publication status=closed, projectStatus=archived, totalDistributed and lead wallet credited.
- [x] **leaveProject extended:** Tickets with beneficiaryId=userId: in_progress → open, beneficiaryId=null, isNeutralTicket=true; done → closed. `frozenInternalMerits = getProjectShares().find(userId).internalMerits` saved via `userCommunityRoleService.setFrozenInternalMerits`; role record kept (not removed) so total includes frozen; member removed from community.members and user memberships; lead notified (`member_left_project`).
- [x] **updateShares(projectId, leadUserId, newFounderSharePercent):** Lead-only; validation `newFounderSharePercent < current && newFounderSharePercent >= 0`; updates community; notifies all members (`shares_changed`).
- [x] **10 notification types added:** project_created, ticket_assigned, ticket_done, ticket_accepted, ticket_evaluated, project_published, project_distributed, project_closed, member_joined, member_left_project, shares_changed. Triggers: createProject (parent lead), createTicket (beneficiary), updateStatus→done (lead), acceptWork (beneficiary), publishToBirzha (members), distribute (members), closeProject (members), approveRequest for project (leads with member_joined), leaveProject (lead), updateShares (members).
- [x] **closeProject investor context:** In `PostClosingService.sendNotifications`, when post has sourceEntityType='project', project name is resolved and prepended to investor message (e.g. "Project \"X\" closed. Pool returned: ...").
- [x] **Frontend:** CloseProjectDialog, LeaveProjectDialog, UpdateSharesDialog, ArchivedProjectCard; ProjectPageClient: lead Close project / Update shares, Leave via dialogs; archived project → read-only UI (no create ticket/discussion, no action buttons); ProjectTabs `readOnly` prop. Profile projects: "Completed projects" section using `useProjects({ projectStatus: 'archived', memberId: user?.id })` and ArchivedProjectCard. Notification icons for new project types. `project.list` supports `memberId` for "my projects" filter.
- [x] Build passes.

## Membership model and frozenInternalMerits

- **Model:** `UserCommunityRole` in `api/apps/meriter/src/domain/models/user-community-role/user-community-role.schema.ts` (collection `user_community_roles`). Roles: `lead` | `participant`.
- **frozenInternalMerits:** Added on `UserCommunityRole` interface and schema as optional number, default 0. Set when user leaves project via `UserCommunityRoleService.setFrozenInternalMerits(userId, projectId, amount)`. Role document is **not** deleted on leave so that `getTotalFrozenInternalMerits(projectId)` can sum frozen amounts; user is removed from `community.members` and user's community memberships.

## publications.close → auto-withdraw → ProjectDistributionService

- **Flow:** User or system calls `publications.close` (tRPC) → `postClosingService.closePost(postId, 'manual')`. Inside `closePost`, after `investmentService.handlePostClose`, the author share is handled: if `post.sourceEntityType === 'project'` and `post.sourceEntityId`, `projectDistributionService.distribute(sourceEntityId, authorAmount)` is called; otherwise the existing wallet credit path is used. So for project posts on Birzha, close triggers auto-withdraw that goes through ProjectDistributionService (founder % + team pool by shares, including frozen in total).

## Decisions made along the way

- **Sprint 3 report:** Added "Context from reconnaissance" block describing membership model, withdraw/merit override locations, and the need to add project branch in PostClosingService for close (done in Sprint 4).
- **founderUserId in tests:** Community schema uses ObjectId for founderUserId; tests use string uid(). Omitted founderUserId in project-close-project.spec.ts; distribution uses lead from UserCommunityRole when founderUserId is not set.
- **memberId in project.list:** Added optional `memberId` to list projects where the user has a role (for profile "Completed projects" and future "my projects" views).
- **ticket_evaluated:** Type added to schema; no separate trigger (evaluated = accepted in current flow).

## Not done / blocked

- None.

## Files created or modified

**Backend**
- `api/apps/meriter/src/domain/models/user-community-role/user-community-role.schema.ts` — frozenInternalMerits added.
- `api/apps/meriter/src/domain/services/user-community-role.service.ts` — getTotalFrozenInternalMerits, setFrozenInternalMerits.
- `api/apps/meriter/src/domain/services/ticket.service.ts` — getProjectShares includes totalFrozen; getTicketsByBeneficiary, setTicketOpenAndNeutral, setTicketClosed; ticket_assigned, ticket_done, ticket_accepted notifications.
- `api/apps/meriter/src/domain/services/project-distribution.service.ts` — totalInternalMerits = totalActive + totalFrozen; project_distributed notifications.
- `api/apps/meriter/src/domain/services/post-closing.service.ts` — ProjectDistributionService injected; author share for sourceEntityType='project' → distribute; sendNotifications accepts projectContext, investor message prefix for project close.
- `api/apps/meriter/src/domain/services/project.service.ts` — closeProject, updateShares, leaveProject extended (tickets, frozen, notify), project_created and project_closed notifications.
- `api/apps/meriter/src/domain/services/community.service.ts` — UpdateCommunityDto founderSharePercent; updateCommunity handles founderSharePercent.
- `api/apps/meriter/src/domain/services/publication.service.ts` — findActiveIdsBySource.
- `api/apps/meriter/src/domain/services/permission.service.ts` — archived project: deny canCreatePublication, canCreatePoll, canVote.
- `api/apps/meriter/src/domain/services/team-join-request.service.ts` — member_joined notification when approving project join.
- `api/apps/meriter/src/domain/models/notification/notification.schema.ts` — 11 new notification types (project_*, ticket_*, member_joined, member_left_project, shares_changed).
- `api/apps/meriter/src/trpc/routers/project.router.ts` — closeProject, updateShares; publishToBirzha project_published notifications; list memberId.
- `api/apps/meriter/test/project-close-project.spec.ts` — closeProject integration test.
- `api/apps/meriter/test/project-distribution.service.spec.ts` — getTotalFrozenInternalMerits mock.
- `docs/prd/projects/reports/SPRINT-3-REPORT.md` — "Context from reconnaissance" block.

**Frontend**
- `web/src/hooks/api/useProjects.ts` — useCloseProject, useUpdateShares; useProjects memberId; list memberId.
- `web/src/components/organisms/Project/CloseProjectDialog.tsx` — new.
- `web/src/components/organisms/Project/LeaveProjectDialog.tsx` — new.
- `web/src/components/organisms/Project/UpdateSharesDialog.tsx` — new.
- `web/src/components/organisms/Project/ArchivedProjectCard.tsx` — new.
- `web/src/components/organisms/Project/ProjectTabs.tsx` — readOnly prop, hide create when readOnly.
- `web/src/app/meriter/projects/[id]/ProjectPageClient.tsx` — dialogs, Close/Update shares/Leave; archived read-only.
- `web/src/app/meriter/profile/projects/Client.tsx` — "Completed projects" section, useProjects archived + memberId, ArchivedProjectCard.
- `web/src/app/meriter/notifications/NotificationsClient.tsx` — icons for new project notification types.
- `web/src/types/api-v1/index.ts` — NotificationType extended with new types.

## Checklist for manual verification

- [ ] Lead closes project → all Birzha posts closed, project archived, members notified.
- [ ] Archived project page is read-only (no publish, leave, create ticket/discussion, vote).
- [ ] Member leaves → in_progress tickets reopened (open, neutral), done tickets closed; frozen merits stored; lead notified.
- [ ] updateShares: only decrease allowed; members notified.
- [ ] Profile → Projects: "Completed projects" lists archived projects where user is member.
- [ ] Notifications: project_created, ticket_assigned, ticket_done, ticket_accepted, project_published, project_distributed, project_closed, member_joined, member_left_project, shares_changed show correct icon and message.
- [ ] Investor notification on project post close includes "Project X closed" context.
