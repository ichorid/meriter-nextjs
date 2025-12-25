import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CookieManager } from './api-v1/common/utils/cookie-manager.util';
import { AppConfig } from './config/configuration';
import { AuthenticationService } from './common/services/authentication.service';

@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger = new Logger(UserGuard.name);

  constructor(
    private authenticationService: AuthenticationService,
    private configService: ConfigService<AppConfig>,
    private cookieManager: CookieManager,
  ) {}

  private clearJwtCookie(response: any): void {
    const cookieDomain = this.cookieManager.getCookieDomain();
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    this.cookieManager.clearAllJwtCookieVariants(response, cookieDomain, isProduction);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get client IP for security logging
    const clientIp =
      request.ip ||
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    const path = request.url;

    // Authenticate using AuthenticationService
    const authResult = await this.authenticationService.authenticateFromRequest({
      req: request,
      allowTestMode: false, // Guards should not use test mode
    });

    if (!authResult.user) {
      // Authentication failed - log security event and clear cookies
      const errorType = authResult.error || 'UNKNOWN';
      const errorMessage = authResult.errorMessage || 'Authentication failed';

      this.logger.debug(
        `Authentication failed: ${errorType} - ${errorMessage}`,
      );

      // Security event: Failed authentication attempt
      this.logger.warn(
        `[SECURITY] Authentication failed: ${errorMessage} - IP: ${clientIp}, Path: ${path}, User-Agent: ${userAgent.substring(0, 100)}`,
      );

      // Clear JWT cookie for all error types
      this.clearJwtCookie(response);

      // Throw appropriate exception
      if (authResult.error === 'NO_TOKEN') {
        throw new UnauthorizedException('No JWT token provided');
      } else if (authResult.error === 'USER_NOT_FOUND') {
        throw new UnauthorizedException('User not found');
      } else {
        throw new UnauthorizedException('Invalid JWT token');
      }
    }

    // Authentication succeeded - set request.user with communityTags from JWT payload
    // UserGuard sets communityTags on request.user (HTTP-specific behavior)
    request.user = {
      ...authResult.user,
      communityTags:
        authResult.jwtPayload?.communityTags ??
        (request.user?.communityTags ?? []),
    };

    return true;
  }
}
