import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IActor } from '@common/abstracts/actors/model/actor.interface';
import { Document } from 'mongoose';
export type OldUserDocument = OldUser & Document;
export type OldUserDataDocument = OldUserData & Document;
@Schema({ collection: 'users' })
export class OldUser {
  @Prop()
  tgUserId: string;

  @Prop()
  token: string;

  @Prop()
  name: string;
}
export const OldUserSchema = SchemaFactory.createForClass(OldUser);

export const mapOldUserToUser = (oldUser: OldUser): Partial<IActor> => {
  return {
    domainName: 'user',

    token: oldUser.token,
    identities: [`telegram://${oldUser.tgUserId}`],
    profile: {
      name: oldUser.name,
    },
  };
};

export const mapUserToOldUser = (user: IActor): Partial<OldUser> => {
  return {
    tgUserId: user.identities[0]?.replace('telegram://', ''),
    token: user.token,
    name: user.profile.name,
  };
};

@Schema({ collection: 'userdatas' })
export class OldUserData {
  @Prop()
  telegramUserId: string;

  @Prop()
  avatarUrl: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;
}
export const OldUserDataSchema = SchemaFactory.createForClass(OldUserData);
