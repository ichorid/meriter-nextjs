import { Injectable, Logger } from '@nestjs/common';

export interface TelegramMessage {
  messageId: string;
  chatId: string;
  userId: string;
  text?: string;
  photo?: string[];
  video?: string;
  entities?: any[];
  date: number;
}

export interface ParsedMessage {
  originalText: string;
  cleanedText: string;
  hashtags: string[];
  beneficiary?: {
    userId: string;
    username?: string;
  };
  hasValidHashtag: boolean;
}

@Injectable()
export class TelegramMessageProcessorService {
  private readonly logger = new Logger(TelegramMessageProcessorService.name);

  parseMessage(message: TelegramMessage): ParsedMessage {
    this.logger.log(`Parsing message: ${message.messageId}`);

    const originalText = message.text || '';
    let cleanedText = originalText;
    const hashtags: string[] = [];
    let beneficiary: { userId: string; username?: string } | undefined;

    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(originalText)) !== null) {
      hashtags.push(match[1]);
    }

    // Extract beneficiary
    const beneficiaryRegex = /\/ben:@?(\w+)/;
    const beneficiaryMatch = originalText.match(beneficiaryRegex);
    if (beneficiaryMatch) {
      beneficiary = {
        userId: beneficiaryMatch[1],
        username: beneficiaryMatch[1],
      };
      // Remove beneficiary command from cleaned text
      cleanedText = cleanedText.replace(beneficiaryRegex, '').trim();
    }

    const hasValidHashtag = hashtags.length > 0;

    this.logger.log(`Parsed message: hashtags=${hashtags.length}, beneficiary=${!!beneficiary}, valid=${hasValidHashtag}`);

    return {
      originalText,
      cleanedText,
      hashtags,
      beneficiary,
      hasValidHashtag,
    };
  }

  extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;
    
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1]);
    }
    
    return hashtags;
  }

  extractBeneficiary(text: string): { userId: string; username?: string } | null {
    const beneficiaryRegex = /\/ben:@?(\w+)/;
    const match = text.match(beneficiaryRegex);
    
    if (match) {
      return {
        userId: match[1],
        username: match[1],
      };
    }
    
    return null;
  }

  cleanText(text: string): string {
    // Remove beneficiary command
    return text.replace(/\/ben:@?\w+\s*/, '').trim();
  }

  isValidPublicationMessage(parsedMessage: ParsedMessage, communityHashtags: string[]): boolean {
    if (!parsedMessage.hasValidHashtag) {
      return false;
    }

    // Check if at least one hashtag is valid for the community
    const hasValidCommunityHashtag = parsedMessage.hashtags.some(hashtag => 
      communityHashtags.includes(hashtag)
    );

    return hasValidCommunityHashtag;
  }

  determineMessageType(message: TelegramMessage): 'text' | 'image' | 'video' {
    if (message.video) {
      return 'video';
    }
    if (message.photo && message.photo.length > 0) {
      return 'image';
    }
    return 'text';
  }
}
