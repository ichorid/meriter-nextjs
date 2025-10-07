import { Injectable } from '@nestjs/common';
import { ActorsService } from '@common/abstracts/actors/actors.service';

@Injectable()
export class AuthService {
  constructor(private actorsService: ActorsService) {}

  async validateActor(username: string, pass: string): Promise<any> {
    const actor = await this.actorsService.findByUsername(username);
    if (actor && actor.password === pass) {
      const { password, ...result } = actor;
      return result;
    }
    return null;
  }
}
