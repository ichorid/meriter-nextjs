import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { uid as uidGen } from 'uid';
import { sign, verify } from 'jsonwebtoken';

import { Model, Query } from 'mongoose';
import { Actor, ActorDocument } from './schema/actor.schema';
import { flattenObjectMeta } from '@common/lambdas/pure/objects';

@Injectable()
export class ActorsService {
  constructor(
    @InjectModel(Actor.name, 'default') private actorModel: Model<ActorDocument>,
    private configService: ConfigService,
  ) {
    this.model = actorModel;
  }

  model: Model<ActorDocument>;

  async upsert<T extends Actor>(domainName: string, condition: any, data: any) {
    console.log('upsert actor', domainName, condition, data);
    type TDocument = T & ActorDocument;

    const conditionEnh = flattenObjectMeta({ domainName, ...condition }) as T;

    const prev = await this.actorModel.findOne({ domainName, ...condition });

    if (prev)
      return (await this.actorModel.findOneAndUpdate(
        conditionEnh,
        { domainName, $set: data },
        {
          new: true,
        },
      )) as TDocument;

    const uid = data.uid ?? uidGen(32);
    const token = data.token ?? uidGen(32);
    
    // Normalize identities to array if it's a string in the condition
    const normalizedCondition = { ...condition };
    if (typeof normalizedCondition.identities === 'string') {
      normalizedCondition.identities = [normalizedCondition.identities];
    }
    
    const newActor = {
      ...normalizedCondition,
      ...data,
      domainName,
      token,
      uid,
      tags: data.tags ?? [],
    };
    console.log(newActor);
    return (await this.actorModel.create(newActor)) as unknown as TDocument;
  }

  findByUsername(username: string) {
    // This is a mock method for testing purposes only
    // In production, this should query the database
    return { password: 'mock_password_for_testing' };
  }

  async getTelegramByActorUri(actorUri: string) {
    if (actorUri.match('://telegram'))
      return actorUri.split('://telegram')?.[1];

    const actorUid = actorUri.split('://')?.[1];
    const actor = await this.model.findOne({ uid: actorUid });
    const tg = actor.identities.find((i) => i.match('telegram'));
    if (tg) return tg.replace('telegram://', '');

    return null;
  }
  signJWT(payload: Record<string, unknown>, exp?: string) {
    console.log('signing jwt', payload, exp);
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwt = sign(
      payload,
      jwtSecret,
      exp && { expiresIn: exp },
    );
    console.log('signing jwt', payload, exp);
    return jwt;
  }

  verifyJWT(jwt: string) {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    return verify(jwt, jwtSecret);
  }

  __testCleanup() {
    return this.actorModel.deleteMany({});
  }
}
