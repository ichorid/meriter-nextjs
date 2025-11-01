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
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Clear cookie with same attributes used when setting it
    // This ensures the cookie is properly cleared in all browsers
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      domain: cookieDomain,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const jwt = request.cookies?.jwt;

    if (!jwt) {
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('jwt.secret');
      
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET is not configured. Please set JWT_SECRET environment variable.');
        throw new UnauthorizedException('JWT secret not configured');
      }

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
        // Clear the invalid JWT cookie so the user can login again
        this.clearJwtCookie(response);
      } else if (errorMessage.includes('expired') || errorMessage.includes('jwt expired')) {
        // Clear expired JWT cookie
        this.clearJwtCookie(response);
      } else {
        // For any other JWT error, also clear the cookie
        this.clearJwtCookie(response);
      }
      
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
