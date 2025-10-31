import { en, TranslationKeys } from './en';
import { ru } from './ru';

type Lang = 'en' | 'ru';

const dictionaries: Record<Lang, Record<string, string>> = {
  en,
  ru,
};

export function t(key: TranslationKeys, lang: Lang = 'en', params?: Record<string, string>): string {
  const dict = dictionaries[lang] || en;
  const template = dict[key] || en[key] || key;
  if (!params) return template;
  return Object.keys(params).reduce((s, p) => s.replace(`{${p}}`, params[p]), template);
}

// Simple community language resolver with in-memory cache
import { InjectModel } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../domain/models/community/community.schema';
import { Model } from 'mongoose';

const communityLangCache = new Map<string, Lang>();

export class CommunityLanguageResolver {
  constructor(@InjectModel(Community.name) private communityModel: Model<CommunityDocument>) {}

  async getLanguageByChatId(chatId: string): Promise<Lang> {
    const cached = communityLangCache.get(chatId);
    if (cached) return cached;
    const community = await this.communityModel.findOne({ telegramChatId: chatId }).lean();
    const lang: Lang = (community?.settings as any)?.language || 'en';
    communityLangCache.set(chatId, lang);
    return lang;
  }

  setLanguageForChat(chatId: string, lang: Lang) {
    communityLangCache.set(chatId, lang);
  }
}

