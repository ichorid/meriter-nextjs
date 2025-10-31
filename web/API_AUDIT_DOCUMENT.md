# API Layer Audit Document

## Overview
This document catalogs all domain logic found in `/lib/api/endpoints/` before deletion to ensure no logic is lost during migration to `/lib/api/v1/`.

## Critical Domain Logic Found

### 1. Auth API (`auth.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Response Structure Handling**: Complex response parsing for Telegram auth
  - Handles `{ success: boolean, data: { user, hasPendingCommunities }, error? }` structure
  - Validates response.data exists before accessing nested properties
  - Provides fallback for `hasPendingCommunities` (defaults to false)
- **Error Handling**: Comprehensive error handling with specific error messages
- **Logging**: Detailed console logging for debugging authentication flow
- **Raw Response Handling**: Uses `postRaw` to handle non-standard response structure

**UNIQUE FEATURES:**
- Telegram widget authentication with user object
- Telegram Web App authentication with initData string
- Both methods return same structure: `{ user: User, hasPendingCommunities: boolean }`

### 2. Publications API (`publications.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Zod Validation**: Uses Zod schemas for input/output validation
  - `CreatePublicationDtoSchema.parse(data)` for input validation
  - `PublicationSchema.parse(response)` for output validation
  - `z.array(PublicationSchema).parse(response)` for array responses
- **Query Parameter Building**: Manual URLSearchParams construction
  - Maps `params.communityId` to `authorId` in query string
  - Maps `params.tag` to `hashtag` in query string
  - Handles pagination, sorting, filtering
- **Multiple Endpoint Patterns**:
  - `/api/v1/publications` (general)
  - `/api/v1/publications/my` (user-specific)
  - `/api/v1/publications?communityId=X` (community-specific)

**UNIQUE FEATURES:**
- Input validation with Zod schemas
- Response validation with Zod schemas
- Query parameter transformation logic

### 3. Comments API (`comments.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Nested Resource Handling**: 
  - `/api/v1/comments/publications/${publicationId}` for publication comments
  - `/api/v1/comments/${commentId}/replies` for comment replies
- **Pagination Support**: Standard pagination parameters
- **CRUD Operations**: Full create, read, update, delete

**UNIQUE FEATURES:**
- Hierarchical comment structure (publications → comments → replies)
- Separate endpoints for different comment contexts

### 4. Communities API (`communities.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Duplicate Methods**: `getCommunityInfo` and `getCommunity` (both call same endpoint)
- **User Profile Integration**: `getUserProfile(userId)` method
- **Admin Operations**: `syncCommunities()` for admin functionality
- **Response Structure**: Returns `{ message: string; syncedCount: number }` for sync

**UNIQUE FEATURES:**
- Community sync functionality
- User profile lookup by Telegram ID
- Admin-specific operations

### 5. Polls API (`polls.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Poll Results**: Separate `getPollResults(id)` endpoint
- **Vote Response Handling**: Returns `VotePollResponse['data']` type
- **PollResult Type**: Custom `PollResult` type (not in shared-types)

**UNIQUE FEATURES:**
- Poll results aggregation
- Vote response type extraction

### 6. Thanks API (`thanks.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Complex Response Structure**: Returns `{ thank: Thank; comment?: Comment; wallet: Wallet }`
- **Dual Context Support**: Both publication and comment thanking
- **Thank Details**: `getThankDetails(thankId)` for detailed thank information
- **Response Data Extraction**: Uses `response.data` pattern

**UNIQUE FEATURES:**
- Optional comment creation with thank
- Wallet balance updates included in response
- Detailed thank information endpoint

### 7. Wallet API (`wallet.ts`)
**CRITICAL LOGIC PRESERVED:**
- **Balance Extraction**: `getBalance()` extracts `response.balance` from wallet object
- **Transaction Updates**: Special `getTransactionUpdates()` with `updates: true` parameter
- **Admin View**: `getAllTransactions()` for admin functionality
- **Free Balance**: `getFreeBalance()` for voting quota
- **Transfer Operations**: Both withdraw and transfer functionality

**UNIQUE FEATURES:**
- Transaction updates with special parameter
- Free balance/quota system
- Transfer between users
- Admin transaction viewing

## Comparison with v1 API

### CRITICAL FINDING: Broken Imports
**The hooks are currently broken!** They import `thanksApi`, `commentsApi`, `pollsApi`, `walletApi` from `@/lib/api`, but `@/lib/api/index.ts` doesn't export these. The old endpoints exist but aren't exported, making the hooks non-functional.

### Missing in v1 API:
1. **Zod Validation**: v1 API doesn't use Zod schemas for validation
2. **Response Structure Handling**: v1 API expects standard response format  
3. **Query Parameter Transformation**: v1 API doesn't transform parameter names
4. **Transaction Updates**: No `updates: true` parameter handling
5. **Poll Results**: No separate poll results endpoint
6. **Thank Details**: No detailed thank information endpoint
7. **Community Sync**: No admin sync functionality
8. **Free Balance**: No quota/free balance system
9. **Complex Response Structures**: v1 API returns simple data, old API returns complex objects

### Logic to Preserve:
1. **Zod validation patterns** from publications API
2. **Response structure handling** from auth API
3. **Query parameter transformations** from publications API
4. **Transaction updates logic** from wallet API
5. **Complex response structures** from thanks API
6. **Admin operations** from communities API
7. **All endpoint methods** - v1 API is missing many methods

### Endpoint Comparison:

| Feature | Old API | v1 API | Status |
|---------|---------|--------|--------|
| Auth - Telegram Widget | ✅ Complex response handling | ✅ Basic | **MIGRATE** |
| Auth - Telegram WebApp | ✅ Complex response handling | ✅ Basic | **MIGRATE** |
| Publications - Zod validation | ✅ Full validation | ❌ None | **MIGRATE** |
| Publications - Query params | ✅ Custom transformations | ❌ Basic | **MIGRATE** |
| Comments - Hierarchical | ✅ Publication/reply endpoints | ✅ Basic | **MIGRATE** |
| Thanks - Complex response | ✅ {thank, comment?, wallet} | ❌ Simple | **MIGRATE** |
| Thanks - Details endpoint | ✅ getThankDetails() | ❌ Missing | **MIGRATE** |
| Polls - Results endpoint | ✅ getPollResults() | ✅ Basic | **MIGRATE** |
| Wallet - Updates | ✅ updates: true param | ❌ Missing | **MIGRATE** |
| Wallet - Free balance | ✅ getFreeBalance() | ✅ Basic | **MIGRATE** |
| Wallet - Transfer | ✅ transfer() | ❌ Missing | **MIGRATE** |
| Communities - Sync | ✅ syncCommunities() | ❌ Missing | **MIGRATE** |

## Migration Strategy:
1. **Port Zod validation** to v1 API client
2. **Add response structure handling** to v1 API
3. **Preserve query parameter logic** in v1 API
4. **Add missing endpoints** to v1 API
5. **Test all functionality** before deletion

## Risk Assessment:
**HIGH RISK** - Significant domain logic will be lost if old API layer is deleted without migration.
