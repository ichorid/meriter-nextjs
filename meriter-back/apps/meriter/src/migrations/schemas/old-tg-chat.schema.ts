import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TgChat } from '../../tg-chats/model/tg-chat.model';
import mongoose, { Document } from 'mongoose';

@Schema({ collection: 'entities' })
export class OldEntity {
  @Prop([String])
  tgChatIds: string[];

  @Prop({
    type: {
      1: String,
      2: String,
      5: String,
      many: String,
    },
  })
  currencyNames: {
    1: string;
    2: string;
    5: string;
    many: string;
  };
  @Prop()
  icon: string;
}

export const OldEntitySchema = SchemaFactory.createForClass(OldEntity);
export type OldEntityDocument = OldEntity & Document;

@Schema({ collection: 'tgchats' })
export class OldTgChat {
  @Prop()
  _id: string;
  @Prop()
  chatId: string;
  @Prop([String])
  administratorsIds: string[];
  @Prop([String])
  tags: string[];
  @Prop()
  name: string;
  @Prop()
  description: string;
  @Prop()
  type: string;
  @Prop()
  title: string;
  @Prop()
  username: string;
  @Prop()
  first_name: string;
  @Prop()
  last_name: string;
  @Prop()
  photo: string;
  @Prop()
  icon: string;
  @Prop()
  url?: string;

  @Prop()
  helpUrl?: string;
}

export const OldTgChatSchema = SchemaFactory.createForClass(OldTgChat);
export type OldTgChatDocument = OldTgChat & Document;

export const mapOldTgChatToTgChat = (
  oldTgChat: Partial<OldTgChat>,
  tgBotUsername: string,
  dailyEmission,
) => {
  return {
    profile: {
      name: oldTgChat.title,
      description: oldTgChat.description,
      avatarUrl: oldTgChat.photo,
      scope: 'meriter',
    },

    domainName: 'tg-chat',
    identities: [`telegram://${oldTgChat.chatId}`],
    administrators: oldTgChat.administratorsIds.map((a) => `telegram://${a}`),
    meta: {
      iconUrl: oldTgChat.icon,
      tgUsername: oldTgChat.username,
      tgBotUsername,
      hashtagLabels: (oldTgChat.tags || []).map((t) => t.replace('#', '')),
      dailyEmission,
      chatAccessLink: oldTgChat.url,
      helpUrl: oldTgChat.helpUrl,
    },
    uid: oldTgChat._id,
  } as Partial<TgChat>;
};

export const mapTgChatToOldTgChat = (tgChat: TgChat) => {
  return {
    _id: tgChat.uid,
    photo: tgChat.profile.avatarUrl,
    title: tgChat.profile.name,
    description: tgChat.profile.description,
    icon: tgChat.meta.iconUrl,
    chatId: tgChat.identities[0].replace('telegram://', ''),
    tags: tgChat.meta.hashtagLabels,
    url: tgChat.meta.url,
    helpUrl: tgChat.meta.helpUrl,
  } as OldTgChat;
};
