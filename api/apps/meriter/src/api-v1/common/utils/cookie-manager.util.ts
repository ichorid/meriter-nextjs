/**
 * Utility class for managing JWT cookies
 */
export class CookieManager {
  /**
   * Get cookie domain from DOMAIN environment variable
   * Returns undefined for localhost (no domain restriction needed)
   * Falls back to APP_URL extraction for backward compatibility if DOMAIN is not set
   */
  static getCookieDomain(): string | undefined {
    const domain = process.env.DOMAIN;
    
    if (domain) {
      // localhost doesn't need domain restriction
      return domain === 'localhost' ? undefined : domain;
    }
    
    // Backward compatibility: if APP_URL exists but DOMAIN doesn't, extract domain from APP_URL
    if (process.env.APP_URL) {
      try {
        const url = new URL(process.env.APP_URL);
        const hostname = url.hostname.split(':')[0]; // Remove port if present
        return hostname === 'localhost' ? undefined : hostname;
      } catch (error) {
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
  static clearAllJwtCookieVariants(
    response: any,
    cookieDomain?: string | undefined,
    isProduction?: boolean
  ): void {
    const production = isProduction ?? process.env.NODE_ENV === 'production';
    const domain = cookieDomain ?? this.getCookieDomain();
    
    const baseOptions = {
      httpOnly: true,
      secure: production,
      sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    
    // Derive all possible domain variants from cookie domain
    const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
    
    if (domain && domain !== 'localhost') {
      domainsToTry.push(domain);
      
      // Add variant with leading dot if it doesn't have one
      if (!domain.startsWith('.')) {
        domainsToTry.push(`.${domain}`);
      }
      
      // Add variant without leading dot if it has one
      if (domain.startsWith('.')) {
        domainsToTry.push(domain.substring(1));
      }
    }
    
    // Remove duplicates while preserving undefined
    const uniqueDomains = Array.from(
      new Set(domainsToTry.map(d => d ?? 'undefined'))
    ).map(d => d === 'undefined' ? undefined : d);
    
    for (const domainVariant of uniqueDomains) {
      try {
        // Method 1: clearCookie
        response.clearCookie('jwt', {
          ...baseOptions,
          domain: domainVariant,
        });
        
        // Method 2: Set cookie to empty with immediate expiry (more reliable)
        response.cookie('jwt', '', {
          ...baseOptions,
          domain: domainVariant,
          expires: new Date(0),
          maxAge: 0,
        });
      } catch (error) {
        // Ignore errors when clearing - some combinations may fail
      }
    }
    
    // Also try without httpOnly in case there's a non-httpOnly cookie (shouldn't happen, but be safe)
    try {
      response.clearCookie('jwt', {
        secure: production,
        sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
        path: '/',
        domain,
      });
      response.cookie('jwt', '', {
        secure: production,
        sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
        path: '/',
        domain,
        expires: new Date(0),
        maxAge: 0,
      });
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Clear any cookie with multiple attribute combinations to ensure all variants are removed
   * @param response Express response object
   * @param cookieName Name of the cookie to clear
   * @param cookieDomain Cookie domain (optional)
   * @param isProduction Whether running in production mode
   */
  static clearCookieVariants(
    response: any,
    cookieName: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean
  ): void {
    const production = isProduction ?? process.env.NODE_ENV === 'production';
    const domain = cookieDomain ?? this.getCookieDomain();
    
    const baseOptions = {
      httpOnly: true,
      secure: production,
      sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    
    // Derive all possible domain variants from cookie domain
    const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
    
    if (domain && domain !== 'localhost') {
      domainsToTry.push(domain);
      
      // Add variant with leading dot if it doesn't have one
      if (!domain.startsWith('.')) {
        domainsToTry.push(`.${domain}`);
      }
      
      // Add variant without leading dot if it has one
      if (domain.startsWith('.')) {
        domainsToTry.push(domain.substring(1));
      }
    }
    
    // Remove duplicates while preserving undefined
    const uniqueDomains = Array.from(
      new Set(domainsToTry.map(d => d ?? 'undefined'))
    ).map(d => d === 'undefined' ? undefined : d);
    
    // Try different path combinations
    const pathsToTry = ['/', '']; // Root path and no path
    
    for (const domainVariant of uniqueDomains) {
      for (const path of pathsToTry) {
        try {
          // Method 1: clearCookie
          response.clearCookie(cookieName, {
            ...baseOptions,
            domain: domainVariant,
            path,
          });
          
          // Method 2: Set cookie to empty with immediate expiry (more reliable)
          response.cookie(cookieName, '', {
            ...baseOptions,
            domain: domainVariant,
            path,
            expires: new Date(0),
            maxAge: 0,
          });
        } catch (error) {
          // Ignore errors when clearing - some combinations may fail
        }
      }
    }
    
    // Also try without httpOnly in case there's a non-httpOnly cookie
    for (const domainVariant of uniqueDomains) {
      for (const path of pathsToTry) {
        try {
          response.clearCookie(cookieName, {
            secure: production,
            sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
            path,
            domain: domainVariant,
          });
          response.cookie(cookieName, '', {
            secure: production,
            sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
            path,
            domain: domainVariant,
            expires: new Date(0),
            maxAge: 0,
          });
        } catch (error) {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Set JWT cookie with proper domain and security settings
   * @param response Express response object
   * @param jwtToken JWT token string
   * @param cookieDomain Cookie domain (optional, will be derived if not provided)
   * @param isProduction Whether running in production mode
   */
  static setJwtCookie(
    response: any,
    jwtToken: string,
    cookieDomain?: string | undefined,
    isProduction?: boolean
  ): void {
    const production = isProduction ?? process.env.NODE_ENV === 'production';
    let domain = cookieDomain ?? this.getCookieDomain();
    
    // For localhost, don't set domain to allow cookie sharing across ports
    // localhost:8002 and localhost:8001 should share cookies
    if (domain === 'localhost' || domain === undefined) {
      domain = undefined; // No domain restriction for localhost
    }
    
    const cookieOptions: any = {
      httpOnly: true,
      secure: production,
      // For localhost in dev, use 'none' to allow cross-port cookie sharing (8002 -> 8001)
      // Browsers allow sameSite='none' with secure=false for localhost
      sameSite: production ? 'none' : (domain === undefined || domain === 'localhost' ? 'none' : 'lax'),
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      path: '/',
    };
    
    // Only set domain if it's not localhost/undefined
    if (domain) {
      cookieOptions.domain = domain;
    }
    
    response.cookie('jwt', jwtToken, cookieOptions);
  }
}

