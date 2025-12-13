# Marathon of Good - Role-Based Permissions Documentation

This document describes the role-based permission system for different group types in the Meriter platform, including how roles are assigned and what permissions each role has.

## Permission Rights Overview

The system defines four main rights:

- **post**: Can create posts, polls, and projects
- **Q**: Can vote with daily quota of this group and leave comments
- **M**: Can vote from permanent Merit wallet of this group and leave comments
- **R**: Can read the group contents and see the group

## User Roles

- **L (Lead)**: Team leader/organizer
- **P (Participant)**: Active participant
- **V (Viewer)**: Read-only access

## Permission Tables

### Future Vision Group

| Role | post | Q | M | R |
|------|------|---|---|---|
| L | ✅ | ❌ | ✅ | ✅ |
| P | ✅ | ❌ | ✅ | ✅ |
| V | ❌ | ❌ | ❌ | ✅ |

**Notes:**
- Future Vision uses wallet (M) voting only - no quota (Q) voting
- Participants can create posts (post=y)
- Viewers can read but cannot vote or post

### Marathon-of-Good Group

| Role | post | Q | M | R |
|------|------|---|---|---|
| L | ✅ | ✅ | ❌ | ✅ |
| P | ✅ | ✅ | ❌ | ✅ |
| V | ❌ | ✅ | ❌ | ✅ |

**Notes:**
- Marathon-of-Good uses quota (Q) voting only - no wallet (M) voting
- Participants can create posts (post=y)
- Viewers can vote using quota and leave comments

### Team Group

| Role | post | Q | M | R |
|------|------|---|---|---|
| L | ✅ | ✅ | ❌ | ✅ |
| P | ✅ | ✅ | ❌ | ✅ |
| V | ❌ | ❌ | ❌ | ❌ |

**Notes:**
- Team groups use quota (Q) voting only - no wallet (M) voting
- Viewers cannot see Team groups (R=n)
- Viewers cannot vote in Team groups (Q=n)

## Role Assignment Logic

Roles are assigned automatically based on how users join the platform:

### 1. Superadmin Invite → Lead

When a superadmin creates an invite and a user accepts it:

- **Marathon-of-Good**: **participant** role
- **Future-Vision**: **participant** role
- **Team Group**: **lead** role (team community is auto-created with user's name)

**Note**: Superadmin invites do not require specifying a target community. Invites are created from the user profile page.

**Implementation**: `api/apps/meriter/src/api-v1/invites/invites.controller.ts` - `useInvite` method for `superadmin-to-lead` type

### 2. Lead Invite → Participant

When a lead creates an invite and a user accepts it:

- **Lead's Team Community**: **participant** role (automatically determined from the lead's team group)
- **Marathon-of-Good**: **viewer** role (auto-assigned)
- **Future-Vision**: **viewer** role (auto-assigned)

**Note**: Lead invites automatically use the lead's team community. The target community is determined automatically when the invite is created. Invites are created from the user profile page.

**Implementation**: `api/apps/meriter/src/api-v1/invites/invites.controller.ts` - `useInvite` method for `lead-to-participant` type

### 3. No Invite (Direct Registration)

When a user registers/authenticates without using an invite:

- **Marathon-of-Good**: **viewer** role (auto-assigned)
- **Future-Vision**: **viewer** role (auto-assigned)
- **Team Groups**: No automatic assignment (must be invited)

**Implementation**: `api/apps/meriter/src/domain/services/user.service.ts` - `ensureUserInBaseCommunities` method

## Voting Restrictions (Q vs M)

### Quota (Q) Voting
- Uses daily quota allocated to users
- Available in: Marathon-of-Good, Team groups
- Viewers can use quota voting in Marathon-of-Good

### Merit Wallet (M) Voting
- Uses permanent wallet balance
- Available in: Future Vision only
- Requires participant or lead role (viewers cannot use wallet voting)

### Implementation Details

**Backend Enforcement**: `api/apps/meriter/src/domain/services/vote.service.ts`
- Future Vision: Blocks quota voting, allows wallet voting only
- Marathon-of-Good: Blocks wallet voting, allows quota voting only
- Team groups: Blocks wallet voting, allows quota voting only

**Frontend Enforcement**: 
- `web/src/components/organisms/Publication/PublicationActions.tsx`
- `web/src/features/comments/components/comment.tsx`
- `web/src/lib/comments/components/CommentCard.tsx`

Vote buttons and popups are configured with the appropriate mode (`wallet-only`, `quota-only`, or `standard`) based on community type.

## Posting Permissions

Posting (creating posts, polls, projects) is controlled by `postingRules.allowedRoles` in the community configuration:

- **Future Vision**: Leads and Participants can post
- **Marathon-of-Good**: Leads and Participants can post
- **Team Groups**: Leads and Participants can post

Viewers cannot create content in any group type.

**Implementation**: 
- Backend: `api/apps/meriter/src/domain/services/permission.service.ts` - `canCreatePublication` and `canCreatePoll`
- Frontend: `web/src/hooks/useCanCreatePost.ts`

## Visibility Rules

### Team Groups
- Viewers cannot see Team groups (R=n)
- Only superadmins, leads, and participants can see Team groups

**Implementation**: 
- Team groups are created with `visibilityRules.visibleToRoles: ['superadmin', 'lead', 'participant']`
- `api/apps/meriter/src/domain/services/permission.service.ts` - `isCommunityVisible` method enforces this

### Special Groups (Marathon-of-Good, Future Vision)
- All roles (including viewers) can see these groups (R=y)

## Auto-Assignment Behavior

When users join without an invite, the system automatically:

1. Adds them to Marathon-of-Good and Future Vision communities
2. Assigns **viewer** role in both communities
3. Creates wallets for quota/wallet voting
4. Does NOT add them to any Team groups

This ensures all users have read access to the main communities and can participate as viewers (voting with quota in Marathon-of-Good).

## Invite Creation

Invites can only be created from the **user profile page** (`/meriter/profile`), not from community settings.

- **Superadmin**: Can create `superadmin-to-lead` invites (no community selection needed)
- **Lead**: Can create `lead-to-participant` invites (automatically uses their team community)

**Implementation**: `web/src/components/organisms/Profile/InviteGeneration.tsx`

## Key Code Locations

### Invite Creation
- Frontend: `web/src/components/organisms/Profile/InviteGeneration.tsx`
- Backend: `api/apps/meriter/src/api-v1/invites/invites.controller.ts` - `createInvite` method

### Invite Processing
- `api/apps/meriter/src/api-v1/invites/invites.controller.ts` - `useInvite` method

### Role Assignment
- `api/apps/meriter/src/domain/services/user.service.ts` - `ensureUserInBaseCommunities` method

### Permission Checks
- `api/apps/meriter/src/domain/services/permission.service.ts`
- `api/apps/meriter/src/domain/services/vote.service.ts`

### Frontend Hooks
- `web/src/hooks/useCanVote.ts` - Vote permission checking
- `web/src/hooks/useCanCreatePost.ts` - Post creation permission checking

### Community Schema
- `api/apps/meriter/src/domain/models/community/community.schema.ts` - Rule definitions

## Summary

The permission system avoids global role-checks and instead uses only group-specific roles, adjusting/creating those by triggers on invites and user registration. This provides fine-grained control over what users can do in each community based on how they joined the platform.

