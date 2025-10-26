# Shared Components Audit Document

## Overview
This document catalogs all domain logic found in `/shared/components/` before migration to ensure no logic is lost during atomic design migration.

## Critical Domain Logic Found

### 1. Layout Components

#### `page.tsx` - Main Page Layout
**CRITICAL LOGIC PRESERVED:**
- **Fixed Bottom Widget Area**: Creates a fixed bottom area for widgets
- **Responsive Layout**: `max-w-2xl mx-auto px-4 py-6` for consistent page width
- **Z-index Management**: `z-50` for bottom widget area
- **Touch Handling**: `touch-none` class for mobile optimization

**UNIQUE FEATURES:**
- Fixed bottom widget area with specific styling
- Consistent page width and padding
- Mobile-optimized touch handling

#### `sections.tsx` - Page Sections
**CRITICAL LOGIC PRESERVED:**
- **Section Management**: Organizes page content into sections
- **Spacing Logic**: Consistent spacing between sections
- **Responsive Design**: Mobile-first responsive patterns

### 2. Navigation Components

#### `menu-breadcrumbs.tsx` - Breadcrumb Navigation
**CRITICAL LOGIC PRESERVED:**
- **Internationalization**: Uses `useTranslations('common')` for i18n
- **Dynamic Breadcrumb Logic**: Complex conditional rendering based on:
  - `chatId` (community ID)
  - `tag` (hashtag)
  - `postText` (publication text)
- **Link Generation**: Dynamic href generation for community pages
- **Icon Integration**: Community icons and home icon
- **Text Truncation**: `line-clamp-2` for long post text
- **Responsive Design**: `flex flex-wrap` for mobile

**UNIQUE FEATURES:**
- Complex conditional breadcrumb logic
- Dynamic link generation
- Text truncation for long content
- Internationalization support

#### `menu-vertical.tsx` - Vertical Menu
**CRITICAL LOGIC PRESERVED:**
- **Menu State Management**: Active/inactive state handling
- **Icon Integration**: Menu icons and styling
- **Responsive Behavior**: Mobile/desktop adaptations

### 3. User Interface Components

#### `header-avatar-balance.tsx` - Header with Avatar and Balance
**CRITICAL LOGIC PRESERVED:**
- **Balance Display**: Dual balance display (balance1, balance2)
- **Avatar Integration**: User avatar with error handling
- **Responsive Grid**: `grid-cols-1 md:grid-cols-2` for mobile/desktop
- **Click Handling**: Optional onClick functionality
- **Error Handling**: `onAvatarUrlNotFound` callback

**UNIQUE FEATURES:**
- Dual balance system
- Responsive grid layout
- Avatar error handling
- Settings navigation

#### `widget-avatar-balance.tsx` - Avatar Balance Widget
**CRITICAL LOGIC PRESERVED:**
- **Balance Display Logic**: Complex balance formatting and display
- **Settings Navigation**: Router push to `/meriter/settings`
- **Avatar Error Handling**: `onAvatarUrlNotFound` callback
- **Internationalization**: Uses `useTranslations('shared')`
- **Responsive Design**: Different sizes for mobile/desktop
- **Click Handling**: Optional onClick functionality

**UNIQUE FEATURES:**
- Settings button with router navigation
- Complex balance display logic
- Responsive avatar sizing
- Internationalization support

#### `card-with-avatar.tsx` - Card with Avatar
**CRITICAL LOGIC PRESERVED:**
- **Avatar Retry Logic**: Retry mechanism for failed avatar loads
- **Icon Integration**: Optional icon display with click handling
- **State Management**: `retryCount` state for avatar retries
- **Conditional Rendering**: Different layouts based on avatar/icon presence
- **Click Handling**: Optional onClick functionality
- **Avatar Update**: `avatarUrlUpd` callback for avatar updates

**UNIQUE FEATURES:**
- Avatar retry mechanism
- Icon integration
- Conditional layout rendering
- Avatar update callbacks

### 4. Interaction Components

#### `bar-thank.tsx` - Thank/Upvote Bar
**CRITICAL LOGIC PRESERVED:**
- **Telegram Integration**: Uses `@telegram-apps/sdk-react` for haptic feedback
- **Haptic Feedback**: Different haptic patterns for different actions
- **Vote Logic**: Plus/minus vote handling with visual feedback
- **Comment Integration**: Comment count display and click handling
- **Event Handling**: `stopPropagation` for click events
- **Visual Feedback**: Color changes based on vote balance

**UNIQUE FEATURES:**
- Telegram haptic feedback integration
- Complex vote display logic
- Comment count integration
- Event propagation handling

#### `bar-withdraw.tsx` - Withdraw Bar
**CRITICAL LOGIC PRESERVED:**
- **Withdrawal Logic**: Withdrawal amount handling
- **Balance Validation**: Balance checking and validation
- **Form Integration**: Integration with withdrawal forms

### 5. Form Components

#### `form-withdraw.tsx` - Withdrawal Form
**CRITICAL LOGIC PRESERVED:**
- **Slider Integration**: Uses `rc-slider` for amount selection
- **Amount Validation**: Min/max amount validation
- **Internationalization**: Uses `useTranslations('shared')`
- **State Management**: Amount and comment state
- **Conditional Rendering**: Shows form only if withdrawal is possible
- **Input Utilities**: Uses `@shared/lib/input-utils` for validation

**UNIQUE FEATURES:**
- Slider-based amount selection
- Complex validation logic
- Internationalization support
- Conditional form rendering

#### `form-edit-hashtag.tsx` - Hashtag Editor
**CRITICAL LOGIC PRESERVED:**
- **Hashtag Management**: Hashtag editing and validation
- **Form Validation**: Input validation and error handling
- **State Management**: Hashtag state management

### 6. Utility Components

#### `avatar-with-placeholder.tsx` - Avatar with Placeholder
**CRITICAL LOGIC PRESERVED:**
- **Avatar Fallback**: Placeholder generation when avatar fails
- **Error Handling**: Avatar load error handling
- **Size Management**: Configurable avatar sizes
- **Name Integration**: Uses name for placeholder generation

#### `community-avatar.tsx` - Community Avatar
**CRITICAL LOGIC PRESERVED:**
- **Community Icon Display**: Community-specific icon handling
- **Fallback Logic**: Fallback to default community icon
- **Size Management**: Configurable community avatar sizes

#### `language-selector.tsx` - Language Selector
**CRITICAL LOGIC PRESERVED:**
- **Internationalization**: Language switching functionality
- **Locale Management**: Locale state management
- **UI Integration**: Language selector UI

#### `theme-toggle.tsx` - Theme Toggle
**CRITICAL LOGIC PRESERVED:**
- **Theme Management**: Dark/light theme switching
- **State Persistence**: Theme preference persistence
- **UI Integration**: Theme toggle UI

### 7. Specialized Components

#### `boomstream-embed.tsx` - Boomstream Video Embed
**CRITICAL LOGIC PRESERVED:**
- **Video Embedding**: Boomstream video integration
- **Responsive Design**: Responsive video player
- **Error Handling**: Video load error handling

#### `tgembed.tsx` - Telegram Embed
**CRITICAL LOGIC PRESERVED:**
- **Telegram Integration**: Telegram-specific embedding
- **Content Rendering**: Telegram content rendering
- **Error Handling**: Embed error handling

#### `withTelegramEntities.tsx` - Telegram Entities HOC
**CRITICAL LOGIC PRESERVED:**
- **Telegram Integration**: Higher-order component for Telegram features
- **Entity Processing**: Telegram entity processing
- **Content Enhancement**: Content enhancement with Telegram features

### 8. Simple Components

#### `simple/simple-page.tsx` - Simple Page Layout
**CRITICAL LOGIC PRESERVED:**
- **Simplified Layout**: Minimal page layout
- **Content Wrapping**: Basic content wrapping
- **Styling**: Simple styling patterns

#### `simple/simple-elements.tsx` - Simple UI Elements
**CRITICAL LOGIC PRESERVED:**
- **Basic Elements**: Basic UI elements
- **Styling**: Simple styling patterns
- **Reusability**: Reusable simple components

### 9. Portal Components

#### `bottom-portal.tsx` - Bottom Portal
**CRITICAL LOGIC PRESERVED:**
- **Portal Management**: React portal for bottom content
- **Z-index Management**: Proper z-index handling
- **Content Rendering**: Bottom content rendering

### 10. Utility Components

#### `transitions.tsx` - Transitions
**CRITICAL LOGIC PRESERVED:**
- **Animation Logic**: Transition animations
- **State Management**: Transition state management
- **Performance**: Optimized transitions

#### `misc.tsx` - Miscellaneous Components
**CRITICAL LOGIC PRESERVED:**
- **Utility Components**: Various utility components
- **Common Patterns**: Common UI patterns
- **Reusability**: Reusable utility components

## Migration Strategy

### High Priority (Critical Domain Logic)
1. **`bar-thank.tsx`** - Telegram integration, haptic feedback, vote logic
2. **`form-withdraw.tsx`** - Slider integration, validation logic
3. **`widget-avatar-balance.tsx`** - Balance display, settings navigation
4. **`menu-breadcrumbs.tsx`** - Complex breadcrumb logic, i18n
5. **`card-with-avatar.tsx`** - Avatar retry logic, conditional rendering

### Medium Priority (Important UI Logic)
1. **`header-avatar-balance.tsx`** - Layout logic, balance display
2. **`page.tsx`** - Layout structure, bottom widget area
3. **`avatar-with-placeholder.tsx`** - Avatar fallback logic
4. **`community-avatar.tsx`** - Community icon logic

### Low Priority (Simple Components)
1. **`language-selector.tsx`** - Simple language switching
2. **`theme-toggle.tsx`** - Simple theme switching
3. **`transitions.tsx`** - Animation utilities
4. **`misc.tsx`** - Utility components

## Risk Assessment

**HIGH RISK** - Significant domain logic will be lost if shared components are deleted without proper migration:
- Telegram integration and haptic feedback
- Complex balance display logic
- Avatar retry mechanisms
- Breadcrumb navigation logic
- Form validation and slider integration
- Internationalization support

## Next Steps

1. **Migrate high-priority components** to atomic design structure
2. **Preserve all domain logic** during migration
3. **Test functionality** after each migration
4. **Update imports** in pages and features
5. **Delete shared components** only after verification
