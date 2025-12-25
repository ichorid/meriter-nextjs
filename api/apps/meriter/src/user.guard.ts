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
import { CookieManager } from './api-v1/common/utils/cookie-manager.util';

@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger = new Logger(UserGuard.name);

  constructor(
    private userService: UserService,
    private configService: ConfigService,
    private cookieManager: CookieManager,
  ) {}

  private clearJwtCookie(response: any): void {
    const cookieDomain = this.cookieManager.getCookieDomain();
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isProduction = nodeEnv === 'production';
    this.cookieManager.clearAllJwtCookieVariants(response, cookieDomain, isProduction);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const jwt = request.cookies?.jwt;
    
    // Get client IP for security logging
    const clientIp = request.ip || 
                     request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     request.headers['x-real-ip'] || 
                     request.connection?.remoteAddress || 
                     'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    const path = request.url;

    if (!jwt) {
      // No cookie detected - proactively clear all possible cookie variants
      // This handles cases where old cookies exist but aren't being read due to
      // attribute mismatches (domain, path, secure, sameSite)
      this.logger.debug('No JWT cookie detected, clearing all possible cookie variants');
      
      // Security event: Failed authentication attempt (no token)
      this.logger.warn(`[SECURITY] Authentication failed: No JWT token provided - IP: ${clientIp}, Path: ${path}, User-Agent: ${userAgent.substring(0, 100)}`);
      
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
        
        // Security event: Valid token but user not found
        const clientIp = request.ip || 
                         request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                         request.headers['x-real-ip'] || 
                         request.connection?.remoteAddress || 
                         'unknown';
        this.logger.warn(`[SECURITY] Authentication failed: User not found for valid JWT - UID: ${uid}, IP: ${clientIp}, Path: ${path}`);
        
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
      
      // Security event logging for different JWT error types
      const clientIp = request.ip || 
                       request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                       request.headers['x-real-ip'] || 
                       request.connection?.remoteAddress || 
                       'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';
      
      // Check for specific JWT errors
      if (errorMessage.includes('invalid signature')) {
        this.logger.error('JWT signature verification failed. This may indicate:');
        this.logger.error('1. JWT_SECRET environment variable is missing or incorrect');
        this.logger.error('2. JWT_SECRET was changed after tokens were issued');
        this.logger.error('3. Tokens were signed with a different secret');
        
        // Security event: Invalid JWT signature (potential attack or misconfiguration)
        this.logger.warn(`[SECURITY] Authentication failed: Invalid JWT signature - IP: ${clientIp}, Path: ${path}, User-Agent: ${userAgent.substring(0, 100)}`);
        
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
        // Security event: Expired token (normal occurrence, but log for monitoring)
        this.logger.debug(`[SECURITY] Authentication failed: Expired JWT token - IP: ${clientIp}, Path: ${path}`);
        // Clear expired JWT cookie
        this.clearJwtCookie(response);
      } else {
        // For any other JWT error, also clear the cookie
        this.logger.debug(`Other JWT verification error: ${errorMessage}`);
        // Security event: Other JWT verification error
        this.logger.warn(`[SECURITY] Authentication failed: JWT verification error - Error: ${errorMessage}, IP: ${clientIp}, Path: ${path}, User-Agent: ${userAgent.substring(0, 100)}`);
        this.clearJwtCookie(response);
      }
      
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
