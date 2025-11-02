import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';

import { UserService } from './domain/services/user.service';

@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger = new Logger(UserGuard.name);

  constructor(
    private userService: UserService,
    private configService: ConfigService,
  ) {}

  private clearJwtCookie(response: any): void {
    // Get cookie domain from DOMAIN environment variable
    // Returns undefined for localhost (no domain restriction needed)
    // Falls back to APP_URL extraction for backward compatibility if DOMAIN is not set
    const domain = process.env.DOMAIN;
    let cookieDomain: string | undefined;
    
    if (domain) {
      // localhost doesn't need domain restriction
      cookieDomain = domain === 'localhost' ? undefined : domain;
    } else if (process.env.APP_URL) {
      // Backward compatibility: if APP_URL exists but DOMAIN doesn't, extract domain from APP_URL
      try {
        const url = new URL(process.env.APP_URL);
        const hostname = url.hostname.split(':')[0]; // Remove port if present
        cookieDomain = hostname === 'localhost' ? undefined : hostname;
      } catch (error) {
        // If APP_URL is not a valid URL, ignore and use undefined
        cookieDomain = undefined;
      }
    }
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Clear cookie with multiple attribute combinations to ensure all variants are removed
    // This is necessary because browsers may have cookies with different attributes
    // (e.g., from different domains, paths, or attribute combinations)
    
    const baseOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/',
    };
    
    // Derive all possible domain variants from cookie domain
    const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
    
    if (cookieDomain && cookieDomain !== 'localhost') {
      domainsToTry.push(cookieDomain);
      
      // Add variant with leading dot if it doesn't have one
      if (!cookieDomain.startsWith('.')) {
        domainsToTry.push(`.${cookieDomain}`);
      }
      
      // Add variant without leading dot if it has one
      if (cookieDomain.startsWith('.')) {
        domainsToTry.push(cookieDomain.substring(1));
      }
    }
    
    // Remove duplicates while preserving undefined
    const uniqueDomains = Array.from(new Set(domainsToTry.map(d => d ?? 'undefined'))).map(d => d === 'undefined' ? undefined : d);
    
    for (const domain of uniqueDomains) {
      try {
        // Method 1: clearCookie
        response.clearCookie('jwt', {
          ...baseOptions,
          domain,
        });
        
        // Method 2: Set cookie to empty with immediate expiry (more reliable)
        response.cookie('jwt', '', {
          ...baseOptions,
          domain,
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
        secure: isProduction,
        sameSite: isProduction ? ('none' as const) : ('lax' as const),
        path: '/',
        domain: cookieDomain,
      });
      response.cookie('jwt', '', {
        secure: isProduction,
        sameSite: isProduction ? ('none' as const) : ('lax' as const),
        path: '/',
        domain: cookieDomain,
        expires: new Date(0),
        maxAge: 0,
      });
    } catch (error) {
      // Ignore errors
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const jwt = request.cookies?.jwt;

    if (!jwt) {
      // No cookie detected - proactively clear all possible cookie variants
      // This handles cases where old cookies exist but aren't being read due to
      // attribute mismatches (domain, path, secure, sameSite)
      this.logger.debug('No JWT cookie detected, clearing all possible cookie variants');
      this.clearJwtCookie(response);
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('jwt.secret');
      
      // Validate JWT secret is configured and not empty
      if (!jwtSecret || jwtSecret.trim() === '') {
        this.logger.error('JWT_SECRET is not configured or is empty. Please set JWT_SECRET environment variable.');
        this.logger.debug(`JWT_SECRET check: exists=${!!jwtSecret}, length=${jwtSecret?.length || 0}, trimmed=${jwtSecret?.trim() || ''}`);
        throw new UnauthorizedException('JWT secret not configured');
      }

      // Log secret status for debugging (without exposing the actual value)
      this.logger.debug(`JWT secret configured: length=${jwtSecret.length}, firstChar=${jwtSecret[0]}, lastChar=${jwtSecret[jwtSecret.length - 1]}`);

      const data: any = verify(jwt, jwtSecret);

      const uid = data.uid;
      const user = await this.userService.getUserById(uid);

      if (!user) {
        this.logger.warn(
          `Valid JWT but user not found for uid: ${uid}`,
        );
        this.logger.warn(
          'This may indicate a deleted user, invalid token, or database issue',
        );
        // Clear the stale JWT cookie
        this.clearJwtCookie(response);
        throw new UnauthorizedException('User not found');
      }

      request.user = {
        ...user,
        communityTags: data.communityTags ?? user.communityTags ?? [],
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      
      // Log detailed error for debugging
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error(`Error verifying JWT: ${errorMessage}`, e instanceof Error ? e.stack : undefined);
      
      // Check for specific JWT errors
      if (errorMessage.includes('invalid signature')) {
        this.logger.error('JWT signature verification failed. This may indicate:');
        this.logger.error('1. JWT_SECRET environment variable is missing or incorrect');
        this.logger.error('2. JWT_SECRET was changed after tokens were issued');
        this.logger.error('3. Tokens were signed with a different secret');
        // Log diagnostic info (without exposing secret)
        const jwtSecret = this.configService.get<string>('jwt.secret');
        if (jwtSecret) {
          this.logger.debug(`Current JWT_SECRET status: configured=true, length=${jwtSecret.length}`);
        } else {
          this.logger.error('JWT_SECRET is not configured in ConfigService');
        }
        // Clear the invalid JWT cookie so the user can login again
        this.clearJwtCookie(response);
      } else if (errorMessage.includes('expired') || errorMessage.includes('jwt expired')) {
        this.logger.debug('JWT token has expired');
        // Clear expired JWT cookie
        this.clearJwtCookie(response);
      } else {
        // For any other JWT error, also clear the cookie
        this.logger.debug(`Other JWT verification error: ${errorMessage}`);
        this.clearJwtCookie(response);
      }
      
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
