# Quota and Merit Dynamics Documentation

## Overview

This document describes the quota and merit dynamics across different group types and user roles in the Meriter platform. It covers how quota is allocated, how voting works, and how merits move between users and communities.

## Group Types

### 1. Regular Groups
- **Type Tags**: `custom`, `political`, `housing`, `volunteer`, `corporate`
- **Voting Rules**: Quota-only voting for posts/comments (wallet blocked)
- **Merit Movement**: Merits credited to beneficiary's wallet in the same community

### 2. Special Groups

#### Marathon of Good (`marathon-of-good`)
- **Voting Rules**: Quota-only voting for posts/comments, wallet voting for polls
- **Merit Movement**: Merits credited to beneficiary's Future Vision wallet (not Marathon wallet)
- **Uniqueness**: Only one instance allowed

#### Future Vision (`future-vision`)
- **Voting Rules**: Wallet-only voting (quota disabled/returns 0)
- **Merit Movement**: No merit accumulation (merits don't credit any wallet)
- **Uniqueness**: Only one instance allowed

### 3. Team Communities (`team`)
- **Voting Rules**: Quota-only voting for posts/comments (wallet blocked)
- **Merit Movement**: Isolated meritonomy - merits stay in team wallet only, no conversion
- **Special Feature**: No cross-community merit conversion

## User Roles and Quota Allocation

| Role | Daily Quota | Can Vote with Wallet |
|------|-------------|---------------------|
| Viewer | 0 | ✅ Yes |
| Participant | Full quota (community setting) | ✅ Yes |
| Lead | Full quota (community setting) | ✅ Yes |
| Superadmin | Full quota (community setting) | ✅ Yes |

**Note**: Future Vision users always receive 0 quota regardless of role (similar to viewers).

## Voting Rules by Group Type

### Summary Table

| Group Type | Quota Voting (Posts/Comments) | Wallet Voting (Posts/Comments) | Wallet Voting (Polls) | Merit Destination | Merit Conversion |
|------------|------------------------------|--------------------------------|----------------------|-------------------|------------------|
| Regular Groups | ✅ Yes (only) | ❌ No (blocked) | ✅ Yes | Same community wallet | N/A |
| Marathon of Good | ✅ Yes (only) | ❌ No (blocked) | ✅ Yes | Future Vision wallet | Cross-community |
| Future Vision | ❌ No (disabled) | ✅ Yes (only) | ✅ Yes | None (no accumulation) | N/A |
| Team Communities | ✅ Yes (only) | ❌ No (blocked) | ✅ Yes | Team wallet only | Isolated (none) |

### Detailed Rules

#### Regular Groups
- **Publications/Comments**: 
  - ✅ Quota voting allowed
  - ❌ Wallet voting blocked
- **Projects**: 
  - ❌ Quota voting blocked
  - ✅ Wallet voting required
- **Polls**: 
  - ✅ Wallet voting only (quota blocked)

#### Marathon of Good
- **Publications/Comments**: 
  - ✅ Quota voting allowed
  - ❌ Wallet voting blocked
- **Projects**: 
  - ❌ Quota voting blocked
  - ✅ Wallet voting required
- **Polls**: 
  - ✅ Wallet voting only (quota blocked)

#### Future Vision
- **Publications/Comments**: 
  - ❌ Quota voting blocked (quota returns 0)
  - ✅ Wallet voting required
- **Projects**: 
  - ❌ Quota voting blocked
  - ✅ Wallet voting required
- **Polls**: 
  - ✅ Wallet voting only (quota blocked)

#### Team Communities
- **Publications/Comments**: 
  - ✅ Quota voting allowed
  - ❌ Wallet voting blocked
- **Projects**: 
  - ❌ Quota voting blocked
  - ✅ Wallet voting required
- **Polls**: 
  - ✅ Wallet voting only (quota blocked)

## Post Type Restrictions

| Post Type | Regular Groups | Marathon of Good | Future Vision |
|-----------|----------------|------------------|---------------|
| Basic/Report | Quota only | Quota only | Wallet only |
| Project | Wallet only | Wallet only | Wallet only |

## Merit Movement Rules

### Regular Groups
- **Flow**: Vote → Beneficiary's wallet in same community
- **Effective Beneficiary**: `beneficiaryId` if set, otherwise `authorId`
- **Timing**: Credited immediately on upvote (withdrawal disabled)

### Marathon of Good
- **Flow**: Vote → Beneficiary's Future Vision wallet
- **Special Rule**: Marathon wallet is NOT credited
- **Transaction Type**: `merit_transfer_gdm_to_fv`
- **Effective Beneficiary**: `beneficiaryId` if set, otherwise `authorId`

### Future Vision
- **Flow**: Vote → No merit accumulation
- **Special Rule**: Votes do not credit any wallet
- **Purpose**: Future Vision is for discussion only, not merit accumulation

### Team Communities
- **Flow**: Vote → Team community wallet only
- **Special Rule**: Isolated meritonomy - no cross-community conversion
- **Effective Beneficiary**: `beneficiaryId` if set, otherwise `authorId`

## Quota System Details

### Quota Allocation
- **Default**: 10 quota/day (configurable per community via `settings.dailyEmission`)
- **Reset**: Daily at midnight (or based on `lastQuotaResetAt`)
- **Tracking**: Separate from wallet balance, tracked via `amountQuota` in votes

### Quota Consumption
- **Upvotes**: Consume quota (if quota voting is allowed)
- **Downvotes**: Do NOT consume quota (wallet only)
- **Polls**: Do NOT consume quota (wallet only)

### Quota Calculation
- **Formula**: `remainingQuota = dailyQuota - usedToday`
- **Used Today**: Sum of `amountQuota` from votes created after quota reset time
- **Future Vision**: Always returns 0 (quota disabled)

## Vote Processing Flow

### Vote Creation
1. **Validation**: Check user permissions, balance, and voting rules
2. **Amount Split**: Split between `quotaAmount` and `walletAmount`
3. **Quota Deduction**: Tracked separately (does not affect wallet)
4. **Wallet Deduction**: Only `walletAmount` deducted from wallet balance
5. **Merit Awarding**: Credited to effective beneficiary (if applicable)

### Vote Validation Rules
- **Double-Zero Rejection**: Cannot vote with both `quotaAmount = 0` and `walletAmount = 0`
- **Quota Limit**: `quotaAmount` cannot exceed remaining daily quota
- **Wallet Balance**: `walletAmount` cannot exceed wallet balance
- **Downvote Rule**: Quota cannot be used for downvotes (wallet only)
- **Group-Specific Rules**: 
  - Marathon of Good: Block wallet voting on posts/comments
  - Future Vision: Block quota voting on posts/comments

## Key Rules Summary

1. **Quota is Separate**: Quota tracking is independent of wallet balance
2. **Viewers Get 0 Quota**: Viewers can only vote with wallet balance
3. **Future Vision Gets 0 Quota**: Future Vision users always have 0 quota
4. **Regular Groups Block Wallet**: Wallet voting blocked on posts/comments
5. **Marathon Blocks Wallet**: Wallet voting blocked on posts/comments (quota only)
6. **Future Vision Blocks Quota**: Quota voting blocked (wallet only)
7. **Marathon Credits Future Vision**: Merits go to Future Vision wallet, not Marathon wallet
8. **Future Vision No Accumulation**: Votes don't credit any wallet
9. **Team Communities Isolated**: No merit conversion, stays in team wallet
10. **Downvotes Wallet Only**: Quota cannot be used for negative votes
11. **Withdrawal Disabled**: Merits credited immediately on upvote

## Error Messages

### Marathon of Good
- **Wallet Voting Blocked**: "Marathon of Good only allows quota voting on posts and comments. Please use daily quota to vote."

### Future Vision
- **Quota Voting Blocked**: "Future Vision only allows wallet voting on posts and comments. Please use wallet merits to vote."
- **Quota Endpoint**: Returns `{ dailyQuota: 0, remainingToday: 0, usedToday: 0 }`

## Implementation Notes

### Identification
- Special groups identified by `typeTag` field: `'marathon-of-good'` or `'future-vision'`
- Lookup method: `getCommunityByTypeTag(typeTag)`
- Uniqueness enforced: Only one instance of each special group allowed

### Quota Endpoint
- **Endpoint**: `GET /api/v1/users/:userId/quota?communityId=...`
- **Future Vision**: Returns 0 quota (same as viewers)
- **Regular Groups**: Returns configured daily quota minus used quota

### Vote Validation
- **Controller**: `validateAndProcessVoteAmounts()` in `votes.controller.ts`
- **Service**: `createVote()` in `vote.service.ts`
- **Both enforce**: Group-specific voting rules before creating vote

