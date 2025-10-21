# Beneficiary Post Feature - Implementation Summary

## Overview
Users can now create posts from Telegram that collect points for another community member by including `/ben:@username` or `/ben:123456` in their message. Points from votes go to the beneficiary instead of the post author.

## Changes Made

### 1. Backend - Data Model
**File**: `api/apps/meriter/src/publications/model/publication.model.ts`
- Added optional `beneficiary?: PublicationMetaAuthor` field to `PublicationMeta` class
- Beneficiary has the same structure as author (name, photoUrl, telegramId, username)

### 2. Backend - Telegram Message Parsing
**File**: `api/apps/meriter/src/tg-bots/tg-bots.service.ts`

**New Method**: `parseBeneficiary(messageText: string, tgChatId: string)`
- Parses `/ben:@username` or `/ben:123456` from message text
- Supports both username and numeric Telegram user ID
- Validates that the beneficiary user exists in the database
- Validates that the beneficiary is a member of the community chat
- Retrieves beneficiary's profile information and photo
- Strips the `/ben:` command from the display text
- Returns `{ beneficiary, cleanedText, error }` where:
  - `beneficiary`: User data if valid, null otherwise
  - `cleanedText`: Message text with /ben: command removed
  - `error`: Error message string if validation fails, null otherwise

**Updated Method**: `processRecieveMessageFromGroup`
- Calls `parseBeneficiary` before creating publication
- If error is returned, sends error message to chat and aborts publication creation
- Otherwise, passes beneficiary data to `publicationAdd`
- Uses cleaned message text for display

**Updated Method**: `publicationAdd`
- Accepts optional `beneficiary` parameter
- Stores beneficiary in publication metadata when provided

### 3. Backend - Points Routing
**File**: `api/apps/meriter/src/transactions/transactions.service.ts`

**Updated Method**: `createForPublication`
- Modified to check for `publication.meta.beneficiary`
- Routes points to beneficiary's telegramId when present
- Falls back to author's telegramId when no beneficiary exists
- Comment: `// Use beneficiary if present, otherwise use author`

### 4. Backend - API Response Mapping
**File**: `api/apps/meriter/src/rest-api/rest/publications/publications.controller.ts`

**Updated Function**: `mapPublicationToOldFormat`
- Added beneficiary fields to API response:
  - `beneficiaryName`
  - `beneficiaryPhotoUrl`
  - `beneficiaryId`
  - `beneficiaryUsername`

### 5. Frontend - Type Definitions
**File**: `web/src/features/feed/types.ts`
- Added `PublicationAuthor` interface
- Updated `Publication` interface with beneficiary fields:
  - `beneficiaryName?: string`
  - `beneficiaryPhotoUrl?: string`
  - `beneficiaryId?: string`
  - `beneficiaryUsername?: string`
  - Also added `tgAuthorId?: string` for consistency

**File**: `web/src/features/feed/components/publication.tsx`
- Updated `IPublication` interface with same beneficiary fields

### 6. Frontend - UI Display
**File**: `web/src/features/feed/components/publication.tsx`

**Updated Component**: `Publication`
- Accepts beneficiary props (beneficiaryName, beneficiaryPhotoUrl, beneficiaryId, beneficiaryUsername)
- Added logic to detect beneficiary presence:
  ```typescript
  const hasBeneficiary = beneficiaryId && beneficiaryId !== tgAuthorId;
  ```
- Creates display title:
  ```typescript
  const displayTitle = hasBeneficiary 
      ? `${tgAuthorName} для ${beneficiaryName}`
      : tgAuthorName;
  ```
- Updated both poll and regular publication `CardPublication` components to use `displayTitle`

## Usage

### Creating a Beneficiary Post
1. In a Telegram group with Meriter bot
2. Create a message with the community hashtag
3. Add `/ben:@username` or `/ben:123456` anywhere in the message
4. The `/ben:` command will be stripped from the displayed text
5. Points from votes will go to the beneficiary

### Example
```
This is a great contribution from our team member! #community /ben:@johndoe
```

This will:
- Create a post with text: "This is a great contribution from our team member! #community"
- Display as: "AuthorName для johndoe"
- Route all voting points to johndoe instead of AuthorName

## Validation Rules and Error Messages

### Validation Checks
1. Beneficiary must exist in the database (previously registered with bot)
2. Beneficiary must be a member of the community chat
3. Message edits do not update the beneficiary (prevents abuse)

### Error Messages Sent to Chat

**User Not Found in Meriter:**
```
⚠️ Пользователь @username не найден в Meriter.

Получатель баллов должен сначала войти на сайт https://meriter.pro через Telegram.
```
- Sent when beneficiary hasn't registered with Meriter
- Publication is NOT created
- Reply is sent to the original message
- Directs user to web login for registration

**User Not a Community Member:**
```
⚠️ Пользователь @username не является участником этого сообщества.
```
- Sent when beneficiary is not in the chat
- Publication is NOT created
- Reply is sent to the original message

**Technical Error:**
```
⚠️ Ошибка при обработке пользователя @username.
```
- Sent when there's an internal error processing the beneficiary
- Publication is NOT created
- Reply is sent to the original message

## Security Considerations
- Message edits are ignored by design (no edit handling in webhook)
- Beneficiary must be a validated community member
- Only users known to the system can be beneficiaries
- No special privileges required to create beneficiary posts

## UI Behavior
- Posts with beneficiaries show: "Author для Beneficiary"
- Posts without beneficiaries show: "Author" (normal behavior)
- Withdrawal functionality remains with the original author
- Voting points go to the beneficiary

