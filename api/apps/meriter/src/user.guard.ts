import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';

import { UsersService } from './users/users.service';

@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger = new Logger(UserGuard.name);

  constructor(
    private userService: UsersService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwt = request.cookies?.jwt;

    if (!jwt) {
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('jwt.secret');
      const data: any = verify(jwt, jwtSecret);

      const token = data.token;
      const user = await this.userService.getByToken(token);

      if (!user) {
        this.logger.warn(
          `Valid JWT but user not found for token: ${token?.substring(0, 10)}...`,
        );
        this.logger.warn(
          'This may indicate a deleted user, invalid token, or database issue',
        );
        throw new UnauthorizedException('User not found');
      }

      const tgUserId = user?.identities?.[0]?.replace('telegram://', '');
      const tgUserName = user?.profile?.name;

      request.user = {
        ...user.toObject(),
        chatsIds: data.tags ?? user.tags ?? [],
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
