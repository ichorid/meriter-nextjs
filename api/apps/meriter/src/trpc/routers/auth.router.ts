import { router, protectedProcedure } from '../trpc';
import { CookieManager } from '../../api-v1/common/utils/cookie-manager.util';

export const authRouter = router({
  /**
   * Logout - clear JWT cookie
   * Note: OAuth callbacks remain as REST endpoints
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieDomain = CookieManager.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    CookieManager.clearAllJwtCookieVariants(ctx.res, cookieDomain, isProduction);

    return { message: 'Logged out successfully' };
  }),

  /**
   * Clear all cookies
   */
  clearCookies: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieDomain = CookieManager.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';

    // Get all cookie names from the request
    const cookieNames = new Set<string>();
    if (ctx.req.cookies) {
      Object.keys(ctx.req.cookies).forEach(name => cookieNames.add(name));
    }

    // Always ensure JWT cookie is cleared
    cookieNames.add('jwt');

    // Also clear known cookies that might exist
    const knownCookies = ['fake_user_id', 'fake_superadmin_id', 'NEXT_LOCALE'];
    knownCookies.forEach(name => cookieNames.add(name));

    // Clear each cookie with all possible attribute combinations
    for (const cookieName of cookieNames) {
      CookieManager.clearCookieVariants(ctx.res, cookieName, cookieDomain, isProduction);
    }

    return { message: 'Cookies cleared successfully' };
  }),
});

