# Navigation Usage Audit

## Summary

Total files using `router.push/replace`: 54 files
Total instances: ~127

## Categorization

### ✅ Keep as Programmatic Navigation (Conditional/Event-Based)

These should remain as `router.push/replace` because they:
- Are conditional based on state/auth/data
- Are in event handlers (onClick, form submissions)
- Handle deep links with dynamic query params
- Navigate based on async operations

**Examples:**
- `PublicationCard.tsx` - Conditional: checks if on community feed page vs detail page
- `CommunityHeroCard.tsx` - Event handler with stopPropagation
- `BottomNavigation.tsx` - Conditional based on community context
- `AuthGuard.tsx` - Conditional redirects based on auth state
- `InviteHandler.tsx` - Conditional redirects after invite processing
- Form submissions - Navigate after successful submission
- Deep link handlers - Navigate based on URL parameters

### 🔄 Could Convert to Link (Simple Navigation)

These could potentially be converted to `Link` components:
- Simple navigation to static routes
- Navigation without conditions
- Navigation in lists/cards where the entire element is clickable

**Note:** After review, most navigation is appropriately programmatic. The few simple cases are already using `Link` components (NavigationBar, VerticalSidebar, Breadcrumbs).

## Recommendations

1. **Keep current approach** - Most programmatic navigation is appropriate
2. **Use Link for static navigation** - Already done in navigation components
3. **Use navigation helpers** - Created `navigation-helpers.ts` for common patterns
4. **Document patterns** - Use helpers for consistency

## Files Using Link Components (Good Examples)

- `NavigationBar.tsx` - Uses Link for static routes ✅
- `VerticalSidebar.tsx` - Uses Link for static routes ✅
- `Breadcrumbs.tsx` - Uses Link for navigation ✅

## Conclusion

The current mix of `Link` and `router.push` is appropriate. Most `router.push` usage is conditional or event-based, which is the correct pattern. The navigation helpers provide a standardized way to handle conditional navigation.

