# Publication Components Audit Document

## Overview
This document catalogs all domain logic found in Publication components before consolidation to ensure no logic is lost.

## Critical Domain Logic Found

### 1. Legacy Publication Component (`/features/feed/components/publication.tsx`)

**CRITICAL LOGIC PRESERVED:**

#### **Vote/Withdrawal System**
- **Author Withdrawal Logic**: Authors can withdraw/add votes to their own posts
- **Optimistic Updates**: `optimisticSum` state for immediate UI feedback
- **Balance Management**: Complex wallet balance tracking and updates
- **Currency Conversion**: Merit/point conversion logic with rate calculations
- **Withdrawal State**: `activeWithdrawPost` state management for UI
- **API Integration**: Uses v1 API for vote creation/deletion

#### **Poll System Integration**
- **Poll Rendering**: Special handling for poll-type publications
- **Poll Voting**: Integration with `PollVoting` component
- **Poll Balance**: Community-specific balance for poll voting
- **Poll State Management**: `pollUserVote`, `pollUserVoteSummary` states

#### **Comment System**
- **Comment Integration**: Uses `useComments` hook for comment management
- **Comment Display**: Conditional comment rendering based on state
- **Comment Form**: Bottom portal for comment form
- **Comment State**: `activeCommentHook` state management

#### **Beneficiary System**
- **Beneficiary Detection**: `hasBeneficiary` logic for different authors
- **Title Display**: Dynamic title based on beneficiary status
- **Withdrawal Restrictions**: Authors can't withdraw from beneficiary posts

#### **Community Integration**
- **Community Info**: Fetches community data using `useCommunity` hook
- **Community Navigation**: Router navigation to community pages
- **Community Avatar**: Community avatar display logic
- **Community Balance**: Community-specific balance calculations

#### **Telegram Integration**
- **Avatar Management**: Telegram avatar fallback logic
- **Entity Processing**: `WithTelegramEntities` for message formatting
- **Avatar Updates**: `telegramGetAvatarLinkUpd` for avatar refresh

#### **UI State Management**
- **Slider State**: `activeSlider` for withdrawal UI
- **Dimensions Editor**: `showDimensionsEditor` for hashtag editing
- **Loading States**: Loading state management for API calls
- **Error Handling**: Error recovery and state rollback

#### **Navigation Logic**
- **Detail Page Navigation**: Router navigation to post detail pages
- **Community Navigation**: Router navigation to community pages
- **Conditional Navigation**: Different behavior for detail vs list pages

#### **Internationalization**
- **Translation Support**: Uses `useTranslations('feed')` for i18n
- **Dynamic Text**: Context-aware text based on user role and state

### 2. Atomic PublicationCard Component (`/components/organisms/PublicationCard/PublicationCard.tsx`)

**SIMPLE IMPLEMENTATION:**
- **Basic Props**: Simple props interface with basic functionality
- **Composition**: Uses atomic design components (Header, Content, Metrics, Actions)
- **No Domain Logic**: Pure UI component with no business logic
- **Event Handlers**: Simple callback props for user interactions

## Comparison Analysis

### Legacy Component Strengths
1. **Complete Domain Logic**: Handles all business rules and edge cases
2. **State Management**: Complex state management for all scenarios
3. **API Integration**: Full API integration with error handling
4. **User Experience**: Rich user experience with optimistic updates
5. **Feature Completeness**: Handles polls, comments, withdrawals, beneficiaries

### Atomic Component Strengths
1. **Clean Architecture**: Follows atomic design principles
2. **Reusability**: Can be used in different contexts
3. **Maintainability**: Simple, focused responsibility
4. **Testability**: Easy to test individual components

### Critical Gap Analysis
**The atomic component is missing ALL domain logic:**
- No vote/withdrawal system
- No poll integration
- No comment system
- No beneficiary handling
- No community integration
- No Telegram integration
- No state management
- No API integration

## Consolidation Strategy

### Option 1: Enhance Atomic Component (RECOMMENDED)
**Preserve all domain logic from legacy component:**

1. **Extract Business Logic**: Move all business logic to custom hooks
2. **Enhance Atomic Components**: Add missing functionality to atomic components
3. **Create Composite Component**: Build a complete Publication component using atomic pieces
4. **Preserve All Features**: Ensure no functionality is lost

### Option 2: Refactor Legacy Component
**Keep legacy component but refactor to atomic design:**

1. **Break Down Legacy**: Split legacy component into atomic pieces
2. **Extract Logic**: Move business logic to hooks
3. **Maintain Functionality**: Keep all existing features
4. **Gradual Migration**: Migrate piece by piece

## Implementation Plan

### Phase 1: Extract Business Logic to Hooks
1. **Create `usePublicationVoting`** hook for vote/withdrawal logic
2. **Create `usePublicationComments`** hook for comment management
3. **Create `usePublicationPolls`** hook for poll integration
4. **Create `usePublicationNavigation`** hook for navigation logic
5. **Create `usePublicationState`** hook for state management

### Phase 2: Enhance Atomic Components
1. **Enhance `PublicationActions`** with vote/withdrawal functionality
2. **Enhance `PublicationContent`** with Telegram entity support
3. **Enhance `PublicationHeader`** with beneficiary and community support
4. **Create `PublicationWithdraw`** component for withdrawal UI
5. **Create `PublicationComments`** component for comment display

### Phase 3: Create Composite Component
1. **Create `Publication`** component that uses all atomic pieces
2. **Integrate all hooks** for complete functionality
3. **Preserve all props** from legacy component
4. **Maintain backward compatibility**

### Phase 4: Migration and Testing
1. **Test all functionality** matches legacy component
2. **Update all imports** to use new component
3. **Delete legacy component** after verification
4. **Update documentation**

## Risk Assessment

**EXTREMELY HIGH RISK** - The legacy component contains critical domain logic:
- Vote/withdrawal system with optimistic updates
- Complex state management for multiple scenarios
- API integration with error handling
- Telegram integration and avatar management
- Community integration and navigation
- Poll system integration
- Comment system integration
- Beneficiary system logic

**Any deletion without proper migration will result in significant functionality loss.**

## Next Steps

1. **Extract business logic** to custom hooks
2. **Enhance atomic components** with missing functionality
3. **Create composite component** that preserves all features
4. **Test thoroughly** before migration
5. **Delete legacy component** only after verification
