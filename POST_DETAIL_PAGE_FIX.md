# Post Detail Page Fix

## Problem
When clicking a link from Telegram to a specific post (e.g., `https://meriter.pro/meriter/communities/-1003040721280/posts/493c0209`), the page showed empty with breadcrumb "home > TEST (community)" instead of displaying the post and its comments.

## Root Cause
The frontend post detail page (`/web/src/app/meriter/communities/[id]/posts/[slug]/page.tsx`) was calling:
```typescript
`/api/rest/publications/${slug}`
```

But this API endpoint **did not exist**. The backend only had these endpoints:
- `GET /api/rest/publications/my` - user's publications
- `GET /api/rest/publications/communities/:chatId` - community publications
- `GET /api/rest/publications/spaces/:slug` - space publications
- `GET /api/rest/publications/spaces/:slug/:publicationSlug` - space publication detail

## Solution
Added a new endpoint to fetch a single publication by slug:

**File**: `api/apps/meriter/src/rest-api/rest/publications/publications.controller.ts`

```typescript
@Get(':slug')
async getPublication(
  @Param('slug') slug: string,
  @Req() req,
) {
  const allowedChatsIds: string[] = req.user.chatsIds;
  const tgUserId = req.user.tgUserId;

  const publ = await this.publicationService.model.findOne({
    uid: slug,
  });

  if (!publ) {
    throw new HttpException(
      `Publication with slug '${slug}' not found`,
      HttpStatus.NOT_FOUND,
    );
  }

  const telegramCommunityChatId = publ.meta.origin.telegramChatId;
  if (!allowedChatsIds.includes(telegramCommunityChatId)) {
    const isMember = await this.tgBotsService.updateUserChatMembership(
      telegramCommunityChatId,
      tgUserId,
    );
    if (!isMember)
      throw new HttpException(
        'not authorized to see this publication',
        HttpStatus.FORBIDDEN,
      );
  }

  return mapPublicationToOldFormat(publ);
}
```

## Important Notes

1. **Route Order**: The `:slug` route is a catch-all pattern and **must be placed last** in the controller, after all specific routes. Otherwise it would intercept requests meant for other endpoints.

2. **Authorization**: The endpoint validates that the user is a member of the community before returning the publication.

3. **Response Format**: Returns the publication in the same format as other endpoints using `mapPublicationToOldFormat()`, including the new beneficiary fields.

## Breadcrumb Text Cleanup

**File**: `web/src/app/meriter/communities/[id]/posts/[slug]/page.tsx`

Added a helper function to clean the post text for display in breadcrumbs:

```typescript
const getCleanPostText = (text: string) => {
    if (!text) return '';
    return text
        .replace(/#\w+/g, '') // Remove hashtags
        .replace(/\/ben:@?\w+/g, '') // Remove /ben: commands
        .trim();
};
```

This ensures the breadcrumb shows only the actual post content without:
- Hashtags (e.g., `#community`)
- Beneficiary commands (e.g., `/ben:@username`)

The cleaned text is then ellipsized to 40 characters for display.

## Expected Behavior After Fix

1. Clicking a post link from Telegram loads the post detail page
2. The post content and comments are displayed
3. Breadcrumb shows: home > [Community Name] > [Clean Post Text (ellipsized to 40 chars)]
4. Hashtags and `/ben:` commands are stripped from breadcrumb
5. URL routing works correctly: `/meriter/communities/[chatId]/posts/[slug]`

## Testing

Test the fix by:
1. Creating a post in Telegram with a hashtag
2. Clicking the link returned by the bot
3. Verifying the post detail page loads with content
4. Checking that comments appear below the post
5. Verifying breadcrumb navigation works correctly

