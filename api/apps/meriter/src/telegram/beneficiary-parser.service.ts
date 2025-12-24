import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSchemaClass, UserDocument } from '../domain/models/user/user.schema';
import type { _User } from '../domain/models/user/user.schema';
import { CommunitySchemaClass, CommunityDocument } from '../domain/models/community/community.schema';
import type { _Community } from '../domain/models/community/community.schema';

export interface BeneficiaryParseResult {
  beneficiary: {
    userId: string;
    username?: string;
    displayName: string;
  } | null;
  cleanedText: string;
  error?: string;
}

@Injectable()
export class BeneficiaryParserService {
  private readonly logger = new Logger(BeneficiaryParserService.name);

  constructor(
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    @InjectModel(CommunitySchemaClass.name) private communityModel: Model<CommunityDocument>,
  ) {}

  async parseBeneficiary(messageText: string, communityId: string): Promise<BeneficiaryParseResult> {
    this.logger.log(`Parsing beneficiary from text: ${messageText.substring(0, 100)}...`);

    if (!messageText) {
      return { beneficiary: null, cleanedText: messageText };
    }

    // Match /ben:@username or /ben:123456
    const benMatch = messageText.match(/\/ben:@?(\w+)/);
    if (!benMatch) {
      return { beneficiary: null, cleanedText: messageText };
    }

    const beneficiaryIdentifier = benMatch[1];
    this.logger.log(`Beneficiary identifier found: ${beneficiaryIdentifier}`);

    // Remove the /ben:@username from the message text
    const cleanedText = messageText.replace(/\/ben:@?\w+\s*/, '').trim();

    // Try to find user by username or telegram ID
    let beneficiaryUser;
    try {
      // First try by username using Mongoose directly
      beneficiaryUser = await this.userModel.findOne({ username: beneficiaryIdentifier }).lean();
      
      // If not found by username, try by telegram ID
      if (!beneficiaryUser) {
        beneficiaryUser = await this.userModel.findOne({ telegramId: beneficiaryIdentifier }).lean();
      }

      if (!beneficiaryUser) {
        return {
          beneficiary: null,
          cleanedText,
          error: `User @${beneficiaryIdentifier} not found in Meriter`,
        };
      }

      // Check if user is member of the community using Mongoose directly
      const community = await this.communityModel.findOne({ id: communityId }).lean();
      if (!community) {
        return {
          beneficiary: null,
          cleanedText,
          error: 'Community not found',
        };
      }

      const isMember = community.members.includes(beneficiaryUser.id);
      if (!isMember) {
        return {
          beneficiary: null,
          cleanedText,
          error: `User @${beneficiaryIdentifier} is not a member of this community`,
        };
      }

      this.logger.log(`Beneficiary found: ${beneficiaryUser.displayName} (${beneficiaryUser.id})`);

      return {
        beneficiary: {
          userId: beneficiaryUser.id,
          username: beneficiaryUser.username,
          displayName: beneficiaryUser.displayName,
        },
        cleanedText,
      };
    } catch (error) {
      this.logger.error(`Error parsing beneficiary ${beneficiaryIdentifier}:`, error);
      return {
        beneficiary: null,
        cleanedText,
        error: `Error processing user @${beneficiaryIdentifier}`,
      };
    }
  }

  extractBeneficiaryCommand(text: string): string | null {
    const benMatch = text.match(/\/ben:@?(\w+)/);
    return benMatch ? benMatch[1] : null;
  }

  removeBeneficiaryCommand(text: string): string {
    return text.replace(/\/ben:@?\w+\s*/, '').trim();
  }

  validateBeneficiarySyntax(text: string): boolean {
    const benMatch = text.match(/\/ben:@?(\w+)/);
    return !!benMatch;
  }
}