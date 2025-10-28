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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const jwt = request.cookies?.jwt;

    if (!jwt) {
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('jwt.secret');
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
        response.clearCookie('jwt', { path: '/' });
        throw new UnauthorizedException('User not found');
      }

      const tgUserId = user?.telegramId;
      const tgUserName = user?.displayName;

      request.user = {
        ...user,
        chatsIds: data.tags ?? user.communityTags ?? [],
        tgUserId,
        tgUserName,
      };
      return true;
    } catch (e) {
      this.logger.error('Error verifying JWT', e.stack);
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
