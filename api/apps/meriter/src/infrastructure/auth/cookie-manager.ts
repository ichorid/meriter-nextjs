import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { COMMUNITY_SESSION_COOKIE } from '../../domain/common/constants/product.constants';

const AUTH_SESSION_SAME_SITE = 'lax' as const;

/**
 * Centralized JWT and auth session cookie management (domain, Secure, SameSite).
 */
@Injectable()
export class CookieManager {
  private readonly logger = new Logger(CookieManager.name);

  constructor(private configService: ConfigService<AppConfig>) {}

  /**
   * Normalize a domain/host string to a bare hostname (no scheme/port/path).
   * Returns undefined for localhost-like hosts.
   */
  private normalizeHostname(input?: string | null): string | undefined {
    if (!input) return undefined;

    const trimmed = String(input).trim();
    if (!trimmed) return undefined;

    const hasLeadingDot = trimmed.startsWith('.');
    const withoutDot = hasLeadingDot ? trimmed.slice(1) : trimmed;

    let hostname: string | undefined;
    try {
      if (withoutDot.includes('://')) {
        const url = new URL(withoutDot);
        hostname = url.hostname;
      } else {
        hostname = withoutDot.split('/')[0]?.split(':')[0];
      }
    } catch {
      hostname = withoutDot.split('/')[0]?.split(':')[0];
    }

    if (!hostname) return undefined;

    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') {
      return undefined;
    }

    return hasLeadingDot ? `.${hostname}` : hostname;
  }

  /**
   * Attempt to get the request hostname from forwarded headers (Caddy) or Host.
   */
  private getRequestHostname(request: any): string | undefined {
    const xfHost = request?.headers?.['x-forwarded-host'];
    const host = xfHost || request?.headers?.host;
    if (!host) return undefined;
    const first = Array.isArray(host) ? host[0] : String(host).split(',')[0];
    return this.normalizeHostname(first);
  }

  /**
   * Get cookie domain from DOMAIN environment variable.
   * Returns undefined for localhost (no domain restriction needed).
   */
  getCookieDomain(): string | undefined {
    const domainRaw = this.configService.get('DOMAIN');
    if (!domainRaw) return undefined;
    return this.normalizeHostname(domainRaw);
  }

  /**
   * Detect HTTPS from req.secure or X-Forwarded-Proto.
   */
  isRequestSecure(request: unknown): boolean {
    const req = request as { secure?: unknown; headers?: Record<string, unknown> } | null;
    if (req?.secure === true) {
      return true;
    }
    const forwardedProto = req?.headers?.['x-forwarded-proto'];
    if (!forwardedProto) return false;

    const raw = Array.isArray(forwardedProto) ? forwardedProto[0] : String(forwardedProto);
    const first = raw.split(',')[0]?.trim().toLowerCase();
    return first === 'https';
  }

  /**
   * Production-mode cookies: NODE_ENV=production or HTTPS request.
   */
  resolveIsProduction(request?: unknown): boolean {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (nodeEnv === 'production') return true;
    if (request != null) return this.isRequestSecure(request);
    return false;
  }

  /**
   * Clear JWT cookies on logout.
   */
  logoutJwt(response: any, request?: unknown): void {
    const cookieDomain = this.getCookieDomain();
    const isProduction = this.resolveIsProduction(request);
    this.clearAllJwtCookieVariants(response, cookieDomain, isProduction);
  }

  /**
   * Clear all cookies visible on the request plus known auth/session cookies.
   */
  clearAllRequestCookies(response: any, request: any): void {
    const cookieDomain = this.getCookieDomain();
    const isProduction = this.resolveIsProduction(request);

    const cookieNames = new Set<string>();
    if (request.cookies) {
      Object.keys(request.cookies).forEach((name) => cookieNames.add(name));
    }

    cookieNames.add('jwt');

    const knownCookies = ['fake_user_id', 'fake_superadmin_id', 'NEXT_LOCALE'];
    knownCookies.forEach((name) => cookieNames.add(name));

    for (const cookieName of cookieNames) {
      this.clearCookieVariants(response, cookieName, cookieDomain, isProduction);
    }
  }

  /**
   * Replace JWT after authentication (full clear) or OAuth callback (host-only clear).
   */
  establishJwtAuth(
    response: any,
    jwtToken: string,
    request: any,
    mode: 'full' | 'oauth' = 'full',
  ): void {
    const cookieDomain = this.getCookieDomain();
    const isProduction = this.resolveIsProduction(request);

    if (mode === 'oauth') {
      this.clearHostOnlyJwtCookie(response, isProduction);
    } else {
      this.clearAllJwtCookieVariants(response, cookieDomain, isProduction);
    }

    this.setJwtCookie(response, jwtToken, cookieDomain, isProduction, request);
  }

  /**
   * Set a non-JWT auth session cookie (e.g. fake_user_id) with centralized attributes.
   */
  setAuthSessionCookie(response: any, name: string, value: string, request: any): void {
    const cookieDomain = this.getCookieDomain();
    const isProduction = this.resolveIsProduction(request);
    const secure = this.isRequestSecure(request) || isProduction;

    response.cookie(name, value, {
      httpOnly: true,
      secure,
      sameSite: AUTH_SESSION_SAME_SITE,
      path: '/',
      domain: cookieDomain,
    });
  }

  /**
   * Clear only the host-only JWT cookie (minimal clearing for OAuth callbacks)
   */
  clearHostOnlyJwtCookie(response: any, _isProduction?: boolean): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const production = _isProduction ?? nodeEnv === 'production';
    const sameSite = AUTH_SESSION_SAME_SITE;
    const secure = production;

    try {
      response.clearCookie('jwt', { path: '/' });
    } catch (_e) {
      // ignore
    }
    try {
      response.cookie('jwt', '', {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
    } catch (_e) {
      // ignore
    }
  }

  /**
   * Clear JWT cookie with multiple attribute combinations to ensure all variants are removed
   */
  clearAllJwtCookieVariants(
    response: any,
    cookieDomain?: string | undefined,
    _isProduction?: boolean,
  ): void {
    const configured = this.normalizeHostname(cookieDomain ?? this.getCookieDomain());

    const domainsToTry: (string | undefined)[] = [undefined];
    if (configured) {
      domainsToTry.push(configured);
      if (configured.startsWith('.')) {
        domainsToTry.push(configured.slice(1));
      } else {
        domainsToTry.push(`.${configured}`);
      }
    }

    const uniqueDomains = Array.from(new Set(domainsToTry.map((d) => d ?? 'undefined'))).map((d) =>
      d === 'undefined' ? undefined : d,
    );

    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const production = _isProduction ?? nodeEnv === 'production';
    const sameSite = AUTH_SESSION_SAME_SITE;
    const secure = production;

    for (const domainVariant of uniqueDomains) {
      try {
        response.clearCookie('jwt', { path: '/', domain: domainVariant });
      } catch (_e) {
        // ignore
      }
      try {
        response.cookie('jwt', '', {
          httpOnly: true,
          secure,
          sameSite,
          path: '/',
          domain: domainVariant,
          expires: new Date(0),
          maxAge: 0,
        });
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * Clear any cookie with multiple attribute combinations
   */
  clearCookieVariants(
    response: any,
    cookieName: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean,
  ): void {
    const configured = this.normalizeHostname(cookieDomain ?? this.getCookieDomain());

    const domainsToTry: (string | undefined)[] = [undefined];
    if (configured) {
      domainsToTry.push(configured);
      if (configured.startsWith('.')) {
        domainsToTry.push(configured.slice(1));
      } else {
        domainsToTry.push(`.${configured}`);
      }
    }

    const uniqueDomains = Array.from(new Set(domainsToTry.map((d) => d ?? 'undefined'))).map((d) =>
      d === 'undefined' ? undefined : d,
    );

    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const production = isProduction ?? nodeEnv === 'production';
    const sameSite = AUTH_SESSION_SAME_SITE;
    const secure = production;

    for (const domainVariant of uniqueDomains) {
      try {
        response.clearCookie(cookieName, { path: '/', domain: domainVariant });
      } catch (_e) {
        // ignore
      }
      try {
        response.cookie(cookieName, '', {
          httpOnly: true,
          secure,
          sameSite,
          path: '/',
          domain: domainVariant,
          expires: new Date(0),
          maxAge: 0,
        });
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * Set JWT cookie with proper domain and security settings
   */
  setJwtCookie(
    response: any,
    jwtToken: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean,
    request?: any,
  ): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const normalizedConfiguredDomain = this.normalizeHostname(cookieDomain ?? this.getCookieDomain());

    const isSecure = request ? this.isRequestSecure(request) : false;
    const requestHost = request ? this.getRequestHostname(request) : undefined;
    const shouldForceSecure = Boolean(requestHost);

    const sameSite = AUTH_SESSION_SAME_SITE;

    const production = isProduction ?? (nodeEnv === 'production' || isSecure || shouldForceSecure);
    const secure = shouldForceSecure ? true : isSecure || production;

    const cookieOptions: any = {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    this.logger.debug(
      `[COOKIE-DEBUG] Setting JWT cookie: domain=${normalizedConfiguredDomain || 'none (host-only)'}, secure=${secure}, sameSite=${sameSite}, requestHost=${requestHost || 'none'}, isProduction=${production}, tokenLength=${jwtToken.length}`,
    );

    response.cookie('jwt', jwtToken, cookieOptions);
    this.logger.debug(
      `[COOKIE-DEBUG] Host-only JWT cookie set: path=/, httpOnly=true, secure=${secure}, sameSite=${sameSite}`,
    );

    if (request && normalizedConfiguredDomain?.startsWith('.')) {
      const reqHost = this.getRequestHostname(request);
      const domainWithoutDot = normalizedConfiguredDomain.slice(1);
      if (reqHost && (reqHost === domainWithoutDot || reqHost.endsWith(`.${domainWithoutDot}`))) {
        try {
          response.cookie('jwt', jwtToken, {
            ...cookieOptions,
            domain: normalizedConfiguredDomain,
          });
          this.logger.debug(
            `[COOKIE-DEBUG] Domain JWT cookie also set: domain=${normalizedConfiguredDomain}`,
          );
        } catch (error) {
          this.logger.warn(
            `[COOKIE-DEBUG] Failed to set domain cookie: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        this.logger.debug(
          `[COOKIE-DEBUG] Skipping domain cookie: reqHost=${reqHost || 'none'}, domainWithoutDot=${domainWithoutDot}, match=${reqHost === domainWithoutDot || (reqHost?.endsWith(`.${domainWithoutDot}`) || false)}`,
        );
      }
    }
  }

  /** Community-web session cookie (isolated from full Meriter `jwt`). */
  establishCommunityJwtAuth(response: any, jwtToken: string, request: any): void {
    this.clearCookieVariants(
      response,
      COMMUNITY_SESSION_COOKIE,
      this.getCommunityCookieDomain(request),
      this.resolveIsProduction(request),
    );
    this.setNamedJwtCookie(
      response,
      COMMUNITY_SESSION_COOKIE,
      jwtToken,
      this.getCommunityCookieDomain(request),
      this.resolveIsProduction(request),
      request,
    );
  }

  logoutCommunityJwt(response: any, request?: unknown): void {
    this.clearCookieVariants(
      response,
      COMMUNITY_SESSION_COOKIE,
      request ? this.getCommunityCookieDomain(request) : this.getCommunityCookieDomain(),
      this.resolveIsProduction(request),
    );
  }

  getCommunityCookieDomain(request?: unknown): string | undefined {
    const configured = this.configService.get('app')?.communityWebBaseUrl;
    if (configured) {
      const fromUrl = this.normalizeHostname(configured);
      if (fromUrl) return fromUrl.startsWith('.') ? fromUrl : `.${fromUrl}`;
    }
    if (request) {
      const host = this.getRequestHostname(request);
      if (host?.includes('community')) {
        return host.startsWith('.') ? host : `.${host}`;
      }
    }
    return undefined;
  }

  private setNamedJwtCookie(
    response: any,
    cookieName: string,
    jwtToken: string,
    cookieDomain: string | undefined,
    isProduction: boolean | undefined,
    request?: any,
  ): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const normalizedConfiguredDomain = this.normalizeHostname(cookieDomain);

    const isSecure = request ? this.isRequestSecure(request) : false;
    const requestHost = request ? this.getRequestHostname(request) : undefined;
    const shouldForceSecure = Boolean(requestHost);

    const sameSite = AUTH_SESSION_SAME_SITE;
    const production = isProduction ?? (nodeEnv === 'production' || isSecure || shouldForceSecure);
    const secure = shouldForceSecure ? true : isSecure || production;

    const cookieOptions: Record<string, unknown> = {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    response.cookie(cookieName, jwtToken, cookieOptions);

    if (request && normalizedConfiguredDomain?.startsWith('.')) {
      const reqHost = this.getRequestHostname(request);
      const domainWithoutDot = normalizedConfiguredDomain.slice(1);
      if (
        reqHost &&
        (reqHost === domainWithoutDot || reqHost.endsWith(`.${domainWithoutDot}`))
      ) {
        response.cookie(cookieName, jwtToken, {
          ...cookieOptions,
          domain: normalizedConfiguredDomain,
        });
      }
    }
  }
}
