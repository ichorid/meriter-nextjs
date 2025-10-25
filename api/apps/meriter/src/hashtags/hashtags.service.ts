import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class HashtagsService {
  private readonly logger = new Logger(HashtagsService.name);

  constructor(@InjectModel('Hashtag') public readonly model: Model<any>) {}

  async createHashtag(data: any): Promise<any> {
    // Stub implementation
    return { id: 'stub', ...data };
  }

  async getInChat(chatId: string): Promise<any[]> {
    // Stub implementation
    return [];
  }

  async upsertList(communityId: string, hashtags: any[]): Promise<void> {
    // Stub implementation
    return;
  }
}
