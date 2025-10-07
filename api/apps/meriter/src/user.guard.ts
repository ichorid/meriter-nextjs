import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { sign, verify } from 'jsonwebtoken';

import { UsersService } from './users/users.service';
import { tsconfigPathsBeforeHookFactory } from '@nestjs/cli/lib/compiler/hooks/tsconfig-paths.hook';

@Injectable()
export class UserGuard implements CanActivate {
  constructor(private userService: UsersService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwt = request.cookies?.jwt;
    if (jwt) {
      try {
        const data: any = verify(jwt, process.env.JWT_SECRET);
        
        const token = data.token;
        //console.log('token',token);
        const user = await this.userService.getByToken(token);
        //console.log('user',user);
        
        if (!user) {
          console.warn(`[UserGuard] Valid JWT but user not found for token: ${token?.substring(0, 10)}...`);
          console.warn('[UserGuard] This may indicate a deleted user, invalid token, or database issue');
          request.user = {};
          return false;
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
        console.log('error in jwt');
        console.log(e);
        request.user={}
        return false;
      }
    }
    
    return false;
  }
}
