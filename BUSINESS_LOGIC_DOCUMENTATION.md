# Meriter Business Logic Documentation

## Overview

Meriter is a merit-based social platform that operates through Telegram communities, where users can create publications, vote for content creators, comment, and participate in polls. The system uses a currency-based merit system where users earn and spend "merits" (points) to participate in community activities.

## Core Business Domains

### 1. Users & Authentication

#### User Identity
- **Primary Identity**: Telegram user ID (`telegram://{userId}`)
- **Actor URI Format**: `actor.user://telegram{userId}`
- **Profile Information**: Name, avatar, username from Telegram
- **Authentication**: Telegram Web Auth authentication

#### User Roles
- **Regular Users**: Can vote for content creators, comment, create publications
- **Community Administrators**: Can manage community settings, hashtags, spaces
- **Bot Administrators**: Can manage bot settings and global configurations

### 2. Communities

#### Community Structure
- **Telegram Chat Integration**: Each community is linked to a Telegram chat/group
- **Community ID**: Telegram chat ID (e.g., `-1001234567890`)
- **Community URI**: `actor.tg-chat://telegram{chatId}`
- **Administrators**: List of Telegram user IDs who can manage the community

#### Community Features
- **Hashtag System**: Communities can define hashtags for content categorization
- **Currency**: Each community has its own merit currency
- **Welcome Messages**: Automated messages explaining the merit system

#### Community Management
- **Bot Addition**: When bot is added to a Telegram group, it becomes a community
- **Bot Removal**: When bot is removed, community is marked as inactive
- **Member Sync**: Bot validates user membership in Telegram groups

### 3. Publications

#### Publication Structure
- **Content**: Text messages from Telegram with hashtags
- **Author**: Telegram user who created the publication
- **Beneficiary**: Optional recipient of merits (can be different from author)
- **Community**: Telegram chat where publication was created
- **Hashtag**: Category/topic identifier
- **Metrics**: Plus votes, minus votes, and sum (net score)

#### Publication Lifecycle
1. **Creation**: User posts message with hashtag in Telegram community
2. **Processing**: Bot processes message and creates publication
3. **Voting**: Community members can vote for publication creators
4. **Ranking**: Publications ranked by net score (sum of votes)

#### Publication Rules
- **Hashtag Requirement**: Must contain at least one community hashtag
- **Beneficiary Support**: Can specify beneficiary with `/ben:@username`
- **Effective Beneficiary**: The effective beneficiary is the `beneficiaryId` if specified, otherwise it's the `authorId`
- **Mutual Exclusivity**: Vote and Withdraw actions are mutually exclusive - a user cannot have both abilities on the same publication

### 4. Voting System

#### Vote Types
- **Publication Votes**: Direct votes on publications
- **Comment Votes**: Votes on comments (replies to publications)
- **Poll Votes**: Votes on poll options (separate from publication voting system)

#### Voting Mechanics
- **Currency**: Votes cost merits with daily quota or from personal wallet in the community
- **Amount**: Users specify how many merits or daily quota to allocate
- **Direction**: Positive (plus) or negative (minus) votes. Minus only possible with merits, not daily quota
- **Balance Check**: Must have sufficient merits or quota to vote
- **Voting Over Quota**: Users can exceed their daily quota by spending available wallet balance. The voting slider represents the full range (quota + wallet). When voting exceeds quota, it automatically uses wallet balance.
- **Combined Voting**: The API supports sending both quotaAmount and walletAmount in a single request, avoiding double API calls. The system automatically splits votes when both amounts are provided.

#### Voting Rules
- **Mutual Exclusivity**: Vote and Withdraw are MUTUALLY EXCLUSIVE. A user can NEVER have both abilities on the same object.
- **Self-Voting Prevention**: Cannot vote for own content when you are the effective beneficiary. Specifically:
  - Cannot vote if you are the author AND there's no beneficiary (effective beneficiary = author)
  - Cannot vote if you are the beneficiary (effective beneficiary = beneficiary)
  - Can vote if you are the author BUT there's a different beneficiary (effective beneficiary ≠ author)
- **Balance Deduction**: Merits deducted from voter's wallet. Quota deducted from voter's personal daily quota.
- **Recipient Credit**: Merits credited to the effective beneficiary's wallet (beneficiaryId if set, otherwise authorId)
- **Free Quota**: Users get free quota daily for voting
- **Quota Amount**: Each community has different quota settings. Default is 10 quota/day.
- **Voting Over Quota**: Users can vote beyond their daily quota by using wallet balance. The maximum vote amount is quota + wallet balance combined.
- **Quota vs Wallet Logic**: For upvotes, quota is used first, then wallet. For downvotes, only wallet can be used (quota cannot be used for negative votes).
- **API Validation**: The API validates that:
  - Votes cannot be double-zero (both quotaAmount and walletAmount cannot be zero)
  - quotaAmount cannot exceed available quota
  - walletAmount cannot exceed available wallet balance
  - Total vote amount (quotaAmount + walletAmount) cannot exceed quota + wallet combined
  - quotaAmount cannot be used for downvotes

#### Vote Processing
1. **Validation**: Check user balance and voting rules
   - Reject double-zero votes (quotaAmount = 0 and walletAmount = 0)
   - Reject if quotaAmount > available quota
   - Reject if walletAmount > available wallet balance
   - Reject if total amount (quotaAmount + walletAmount) > quota + wallet combined
   - Reject if quotaAmount > 0 for downvotes
2. **Amount Calculation**: Calculate quotaAmount and walletAmount
   - For upvotes: quotaAmount = min(requestedAmount, availableQuota), walletAmount = max(0, requestedAmount - availableQuota)
   - For downvotes: quotaAmount = 0, walletAmount = requestedAmount
3. **Vote Creation**: Create vote documents atomically
   - If both quotaAmount and walletAmount > 0: Create two vote documents (one quota, one wallet)
   - If only quotaAmount > 0: Create single quota vote
   - If only walletAmount > 0: Create single wallet vote
4. **Balance Deduction**: Deduct from quota (if used) and wallet (if used)
5. **Metrics Update**: Update publication/comment vote counts
6. **Transaction Record**: Create transaction record for audit

### 5. Comments System

#### Comment Structure
- **Parent**: Publication or another comment
- **Author**: Telegram user who created the comment
- **Content**: Text content of the comment
- **Votes**: Plus/minus votes from other users
- **Metrics**: Vote counts and net score

#### Comment Rules
- **No Beneficiary Support**: Comments CANNOT have beneficiaries. The effective beneficiary is always the author.
- **Voting Cost**: Comments can be voted for (costs merits) - **Note: Comment voting can be disabled via feature flag**
- **Nesting**: Comments can be replies to other comments
- **Content Validation**: Must have meaningful content
- **Vote Allocation**: Users specify merit amount for voting
- **Mutual Exclusivity**: Vote and Withdraw are MUTUALLY EXCLUSIVE. Author can withdraw, others can vote.
- **Feature Flag**: Comment voting is controlled by `ENABLE_COMMENT_VOTING` (backend) and `NEXT_PUBLIC_ENABLE_COMMENT_VOTING` (frontend). When disabled (default), users can only vote on posts/publications, not on comments.

#### Comment Lifecycle
1. **Creation**: User creates comment on publication
2. **Voting**: Other users can vote for comment creators
3. **Ranking**: Comments ranked by net vote score
4. **Threading**: Comments can be nested replies

### 6. Polls System

#### Poll Structure
- **Question**: Poll question text
- **Options**: Multiple choice options
- **Duration**: Poll expiration time
- **Community**: Associated community
- **Votes**: Vote counts per option (different from publication voting system)
- **Total Votes**: Sum of all votes cast

#### Poll Voting (Separate from Publication Voting)
- **Merit Cost**: Each vote costs merits
- **Amount**: Users specify merit amount per vote
- **Option Selection**: Choose which option to vote for
- **Balance Check**: Must have sufficient merits

#### Poll Rules
- **Time Limit**: Polls have expiration dates
- **Multiple Votes**: Users can vote multiple times with different amounts
- **Option Validation**: Must select valid option
- **Balance Deduction**: Merits deducted from voter's wallet

### 7. Wallet & Currency System

#### Wallet Structure
- **User**: Telegram user ID
- **Community**: Community/currency identifier
- **Balance**: Current merit balance
- **Currency Names**: Human-readable currency names

#### Currency Types
- **Community Currency**: Each community has its own currency
- **Free Merits**: Daily free merits for voting
- **Personal Merits**: Earned merits from content creation

#### Wallet Operations
- **Balance Check**: Verify sufficient funds before transactions
- **Deposit**: Add merits to wallet (from votes received)
- **Withdrawal**: Deduct merits from wallet (for voting)
- **Withdrawal from Content**: The effective beneficiary (author or beneficiary) can withdraw accumulated votes from their publications/comments to their permanent wallet
- **Initialization**: Create wallet when user first participates

#### Merit Sources
- **Vote Receipts**: Earn merits when others vote for your content
- **Free Daily**: Receive free merits daily for voting
- **Community Rewards**: Special rewards from community activities

### 8. Transactions

#### Transaction Types
- **Publication Vote**: Vote on publication
- **Comment Vote**: Vote on comment
- **Poll Vote**: Vote on poll option
- **Comment Creation**: Create comment with merit allocation

#### Transaction Structure
- **Initiator**: User who initiated the transaction
- **Subject**: User who receives the transaction
- **Amount**: Merit amount transferred
- **Type**: Transaction type (vote, comment, poll vote, etc.)
- **Metadata**: Additional transaction information

#### Transaction Processing
1. **Validation**: Check user permissions and balance
2. **Amount Split**: Split between free and personal merits
3. **Wallet Updates**: Update both user wallets
4. **Metrics Update**: Update content vote counts
5. **Audit Trail**: Record transaction for tracking

### 9. Hashtags & Categorization

#### Hashtag System
- **Community Hashtags**: Defined by community administrators
- **Content Categorization**: Publications categorized by hashtags
- **Search & Discovery**: Users can browse by hashtag

#### Special Hashtags
- **Community-specific**: Each community defines its own hashtags
- **Required**: Publications must have at least one hashtag

### 10. Bot Integration

#### Telegram Bot Features
- **Message Processing**: Monitor Telegram messages for hashtags
- **Publication Creation**: Create publications from Telegram messages
- **User Management**: Track user membership in communities
- **Admin Functions**: Community management commands

#### Bot Commands
- **Community Setup**: Initialize community with hashtags
- **User Sync**: Sync user membership with Telegram
- **Content Processing**: Process messages and create publications
- **Admin Tools**: Community management tools

## Business Rules Summary

### Core Rules
1. **Merit-Based Participation**: All voting and poll voting costs merits
2. **Community Isolation**: Each community has its own currency and rules
3. **Telegram Integration**: All users must be Telegram users
4. **Hashtag Requirement**: Publications must contain community hashtags
5. **Vote/Withdraw Mutual Exclusivity**: Users cannot vote and withdraw from the same object. See Voting Rules section for detailed beneficiary logic.

### Voting Rules
1. **Balance Requirement**: Must have sufficient merits (daily limit and/or wallet score) to vote
2. **Amount Specification**: Users specify merit amount for each vote
3. **Free Merit Allocation**: Daily free merits for voting
4. **Recipient Credit**: Merits go to the effective beneficiary's wallet (beneficiaryId if set, otherwise authorId). The effective beneficiary can withdraw accumulated votes from the publication/comment to their permanent merit wallet at any time.
5. **Mutual Exclusivity Enforcement**: Users cannot vote and withdraw from the same object. The API enforces that:
   - Users cannot vote if they are the effective beneficiary
   - Users cannot withdraw if they are not the effective beneficiary
   - Withdraw is only available when the object has a positive balance (sum > 0)
6. **Voting Over Quota**: Users can vote beyond daily quota by spending wallet balance. The maximum vote range is quota + wallet combined.
7. **Quota vs Wallet Usage**:
   - For upvotes: Quota is used first, then wallet if amount exceeds quota
   - For downvotes: Only wallet can be used (quota cannot be used for negative votes)
8. **Vote Amount Validation**:
   - Cannot vote with both quotaAmount = 0 and walletAmount = 0 (double-zero rejection)
   - quotaAmount cannot exceed remaining daily quota
   - walletAmount cannot exceed wallet balance
   - Total vote amount cannot exceed quota + wallet combined

### Content Rules
1. **Hashtag Validation**: Must contain valid community hashtags
2. **Beneficiary Support**: Can specify different recipient for merits
3. **Content Quality**: Meaningful content required for comments
4. **Community Membership**: Must be community member to participate

### Administrative Rules
1. **Community Management**: Only administrators can manage communities
2. **Bot Integration**: Bot must be added to Telegram group for community
3. **User Validation**: Bot validates user membership in Telegram groups
4. **Content Moderation**: Administrators can manage community content

## Feature Flags

Feature flags allow enabling or disabling specific features without code changes. They are controlled via environment variables.

### Comment Voting Feature Flag

**Purpose**: Control whether users can vote on comments (replies to publications).

**Environment Variables**:
- **Backend**: `ENABLE_COMMENT_VOTING` (default: `false` - disabled)
- **Frontend**: `NEXT_PUBLIC_ENABLE_COMMENT_VOTING` (default: `false` - disabled)

**Behavior**:
- **When Disabled (default)**:
  - Users can only vote on posts/publications
  - Comment voting UI (vote button and counter) is hidden
  - API endpoints reject comment voting requests
  - Comments still display vote metrics (read-only) from previous votes if any existed

- **When Enabled**:
  - Users can vote on comments using the same voting mechanics as posts
  - Vote button and counter appear on comment cards
  - Comments can receive upvotes/downvotes with quota or wallet merits
  - Comment voting follows the same rules as publication voting (mutual exclusivity, self-voting prevention, etc.)

**To Enable**:
1. Set `ENABLE_COMMENT_VOTING=true` in backend environment (`.env` or Docker environment)
2. Set `NEXT_PUBLIC_ENABLE_COMMENT_VOTING=true` in frontend environment (`.env` or Docker environment)
3. Restart both backend and frontend services

**Implementation Details**:
- Feature flag is checked at multiple layers:
  - Frontend UI components (hides/shows vote button)
  - Frontend API client (validates before making requests)
  - Backend API endpoint (validates before processing)
  - Backend service layer (validates before creating votes)
- This multi-layer approach ensures the feature cannot be bypassed even if one layer fails

### Comment/ Vote Image Uploads Feature Flag

**Purpose**: Control whether users can attach images to votes and comments.

**Environment Variables**:
- **Backend**: `ENABLE_COMMENT_IMAGE_UPLOADS` (default: `false` - disabled)
- **Frontend**: `NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS` (default: `false` - disabled)

**Behavior**:
- **When Disabled (default)**:
  - Users cannot upload images when creating votes or comments
  - The ImageGallery component is hidden in voting/comment forms
  - API endpoints reject requests that include image arrays with a `BadRequestException`
  - Existing votes/comments with images still display properly (read-only)

- **When Enabled**:
  - Users can attach images to votes and comments using the ImageGallery component
  - Image upload UI appears in voting/comment forms
  - API accepts image arrays in vote and comment DTOs
  - Images are validated and uploaded to S3 storage (if configured)

**To Enable**:
1. Set `ENABLE_COMMENT_IMAGE_UPLOADS=true` in backend environment (`.env` or Docker environment)
2. Set `NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS=true` in frontend environment (`.env` or Docker environment)
3. Restart both backend and frontend services

**Implementation Details**:
- Feature flag is checked at multiple layers:
  - Frontend UI components (conditionally renders ImageGallery component)
  - Frontend mutation handlers (excludes images from API calls when disabled)
  - Backend API controllers (validates and rejects image arrays when disabled)
- This multi-layer approach ensures the feature cannot be bypassed even if one layer fails
- All existing image handling code remains intact, just conditionally disabled

## Data Flow

### Publication Creation Flow
1. User posts message with hashtag in Telegram
2. Bot detects message and extracts hashtags
3. Bot creates publication record
4. Publication appears in community feed
5. Users can vote for publication creators

### Voting Flow
1. User selects content to vote for
2. User specifies merit amount
3. System checks user balance
4. System deducts merits from voter
5. System credits merits to recipient
6. System updates content metrics
7. System creates transaction record

### Comment Flow
1. User creates comment on publication
2. User can allocate merits to comment
3. Other users can vote for comment creators
4. Comment appears in thread
5. Votes update comment metrics

This business logic forms the foundation of the Meriter platform, enabling merit-based social interaction within Telegram communities.
