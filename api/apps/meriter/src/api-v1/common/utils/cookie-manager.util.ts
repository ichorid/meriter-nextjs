import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';

/**
 * Injectable service for managing JWT cookies
 */
@Injectable()
export class CookieManager {
  constructor(private configService: ConfigService<AppConfig>) {}

  /**
   * Normalize a domain/host string to a bare hostname (no scheme/port/path).
   * Returns undefined for localhost-like hosts.
   */
  private normalizeHostname(input?: string | null): string | undefined {
    if (!input) return undefined;

    const trimmed = String(input).trim();
    if (!trimmed) return undefined;

    // Preserve leading dot if provided explicitly (domain cookie)
    const hasLeadingDot = trimmed.startsWith('.');
    const withoutDot = hasLeadingDot ? trimmed.slice(1) : trimmed;

    // If someone accidentally provided a full URL, parse it.
    // Otherwise, treat it as host[:port][/path]
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
    // x-forwarded-host can be a comma-separated list
    const first = Array.isArray(host) ? host[0] : String(host).split(',')[0];
    return this.normalizeHostname(first);
  }

  /**
   * Get cookie domain from DOMAIN environment variable
   * Returns undefined for localhost (no domain restriction needed)
   * Falls back to APP_URL extraction for backward compatibility if DOMAIN is not set
   */
  getCookieDomain(): string | undefined {
    const domainRaw = this.configService.get('DOMAIN');
    
    if (domainRaw) {
      // Allow DOMAIN to be either a bare hostname or a full URL; normalize defensively.
      return this.normalizeHostname(domainRaw);
    }
    
    // Backward compatibility: if APP_URL exists but DOMAIN doesn't, extract domain from APP_URL
    const appUrl = this.configService.get('APP_URL');
    if (appUrl) {
      try {
        const url = new URL(appUrl);
        return this.normalizeHostname(url.hostname);
      } catch (_error) {
        // If APP_URL is not a valid URL, return undefined
        return undefined;
      }
    }
    
    return undefined;
  }

  /**
   * Clear JWT cookie with multiple attribute combinations to ensure all variants are removed
   * @param response Express response object
   * @param cookieDomain Cookie domain (optional)
   * @param isProduction Whether running in production mode
   */
  clearAllJwtCookieVariants(
    response: any,
    cookieDomain?: string | undefined,
    _isProduction?: boolean
  ): void {
    // IMPORTANT:
    // Do NOT emit dozens of Set-Cookie headers in an attempt to clear "every possible variant".
    // Large Set-Cookie header payloads can get truncated by proxies/browsers, causing the *real*
    // JWT cookie set during OAuth to be dropped -> users.getMe keeps returning 401 -> infinite loops.
    //
    // For deletion, browsers key cookies by (name, domain, path). Attributes like SameSite/Secure/HttpOnly
    // do not need combinatorial clearing. We clear the minimal, known variants:
    // - host-only cookie (no Domain attribute)
    // - configured domain cookies (with/without leading dot) if a domain is configured
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
      d === 'undefined' ? undefined : d
    );

    // Keep deletion options stable and small.
    // We always delete Path=/ since that's the only path we ever set for jwt.
    // We use SameSite=Lax (first-party). Secure depends on environment.
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const production = _isProduction ?? (nodeEnv === 'production');
    const sameSite = 'lax' as const;
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
   * Clear any cookie with multiple attribute combinations to ensure all variants are removed
   * @param response Express response object
   * @param cookieName Name of the cookie to clear
   * @param cookieDomain Cookie domain (optional)
   * @param isProduction Whether running in production mode
   */
  clearCookieVariants(
    response: any,
    cookieName: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean
  ): void {
    // Same rationale as clearAllJwtCookieVariants: keep Set-Cookie headers minimal.
    // For clearing, only (name, domain, path) matter.
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
      d === 'undefined' ? undefined : d
    );

    // We only ever set cookies at Path=/ in this app; keep it simple and reliable.
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const production = isProduction ?? (nodeEnv === 'production');
    const sameSite = 'lax' as const;
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
   * Helper to detect if request is secure (HTTPS)
   * Checks req.secure and X-Forwarded-Proto header
   * @param request Express request object
   * @returns true if request is over HTTPS
   */
  private isRequestSecure(request: any): boolean {
    // Check req.secure (works when trust proxy is configured)
    if (request.secure === true) {
      return true;
    }
    // Fallback: check X-Forwarded-Proto header directly
    const forwardedProto = request.headers?.['x-forwarded-proto'];
    if (!forwardedProto) return false;

    const raw = Array.isArray(forwardedProto) ? forwardedProto[0] : String(forwardedProto);
    // Can be "https" or "https,http" depending on proxy chain
    const first = raw.split(',')[0]?.trim().toLowerCase();
    return first === 'https';
  }

  /**
   * Set JWT cookie with proper domain and security settings
   * @param response Express response object
   * @param jwtToken JWT token string
   * @param cookieDomain Cookie domain (optional, will be derived if not provided)
   * @param isProduction Whether running in production mode (optional, will be derived if not provided)
   * @param request Express request object (optional, used to detect HTTPS more reliably)
   */
  setJwtCookie(
    response: any,
    jwtToken: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean,
    request?: any
  ): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    // Prefer host-only cookies for reliability.
    // Domain cookies are easy to misconfigure and can get silently dropped by browsers.
    // We only use a Domain cookie if the configured domain is explicitly prefixed with a dot,
    // e.g. ".meriter.pro" (meaning "share across subdomains").
    const normalizedConfiguredDomain = this.normalizeHostname(cookieDomain ?? this.getCookieDomain());
    
    // Detect if request is secure (HTTPS)
    const isSecure = request ? this.isRequestSecure(request) : false;
    const requestHost = request ? this.getRequestHostname(request) : undefined;
    // If we're not on localhost-like hostnames, always force Secure cookies.
    // This prevents broken auth on HTTPS behind proxies when x-forwarded-proto is missing/misformatted.
    const shouldForceSecure = Boolean(requestHost);
    
    // Meriter runs the API behind the same origin (Caddy proxies /api and /trpc),
    // so a first-party cookie with SameSite=Lax is the correct default and avoids
    // "SameSite=None requires Secure" rejection issues.
    const sameSite = 'lax' as const;

    // Secure cookies are recommended on any non-localhost host.
    // We force Secure if we can determine we're on a real hostname, even if proxy headers are imperfect.
    const production = isProduction ?? (nodeEnv === 'production' || isSecure || shouldForceSecure);
    const secure = shouldForceSecure ? true : (isSecure || production);
    
    const cookieOptions: any = {
      httpOnly: true,
      secure,
      // For localhost in dev, use 'lax' (sameSite='none' requires secure=true in modern browsers)
      // 'lax' works fine for same-origin requests (Next.js rewrites proxy to same origin)
      sameSite,
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      path: '/',
    };

    // 1) Always set a host-only cookie (no Domain attribute). This is the most reliable option.
    response.cookie('jwt', jwtToken, cookieOptions);

    // 2) Optionally also set a domain cookie ONLY if explicitly configured with a leading dot
    // and it matches the request hostname (avoid setting unrelated domains).
    if (request && normalizedConfiguredDomain?.startsWith('.')) {
      const reqHost = this.getRequestHostname(request);
      const domainWithoutDot = normalizedConfiguredDomain.slice(1);
      if (reqHost && (reqHost === domainWithoutDot || reqHost.endsWith(`.${domainWithoutDot}`))) {
        try {
          response.cookie('jwt', jwtToken, {
            ...cookieOptions,
            domain: normalizedConfiguredDomain,
          });
        } catch {
          // If domain cookie setting fails, host-only cookie is still set.
        }
      }
    }
  }
}

