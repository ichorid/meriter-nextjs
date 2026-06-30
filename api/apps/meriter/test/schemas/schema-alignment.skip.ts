import {
  UserSchema as ZodUserSchema,
  CommunitySchema as ZodCommunitySchema,
  PublicationSchema as ZodPublicationSchema,
  CommentSchema as ZodCommentSchema,
  VoteSchema as ZodVoteSchema,
  PollSchema as ZodPollSchema,
  WalletSchema as ZodWalletSchema,
  TransactionSchema as ZodTransactionSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { UserSchema as MongooseUserSchema } from '../../src/domain/models/user/user.schema';
import { CommunitySchema as MongooseCommunitySchema } from '../../src/domain/models/community/community.schema';
import { PublicationSchema as MongoosePublicationSchema } from '../../src/domain/models/publication/publication.schema';
import { CommentSchema as MongooseCommentSchema } from '../../src/domain/models/comment/comment.schema';
import { VoteSchema as MongooseVoteSchema } from '../../src/domain/models/vote/vote.schema';
import { PollSchema as MongoosePollSchema } from '../../src/domain/models/poll/poll.schema';
import { WalletSchema as MongooseWalletSchema } from '../../src/domain/models/wallet/wallet.schema';
import { TransactionSchema as MongooseTransactionSchema } from '../../src/domain/models/transaction/transaction.schema';
import { extractZodFields, extractMongooseFields, compareFields } from './schema-alignment.helper';

describe('Schema Alignment', () => {
  describe('User Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodUserSchema);
      const mongooseFields = extractMongooseFields(MongooseUserSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      // All Zod fields should exist in Mongoose
      expect(comparison.missingInMongoose).toEqual([]);
      
      // Mongoose may have additional fields (like indexes), but core fields should match
      // Allow createdAt/updatedAt to be handled by timestamps option
      const coreMongooseFields = mongooseFields.filter(
        f => !['createdAt', 'updatedAt'].includes(f.name)
      );
      const coreZodFields = zodFields.filter(
        f => !['createdAt', 'updatedAt'].includes(f.name)
      );
      
      expect(coreZodFields.length).toBeGreaterThan(0);
      expect(coreMongooseFields.length).toBeGreaterThanOrEqual(coreZodFields.length);
    });
  });

  describe('Community Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodCommunitySchema);
      const mongooseFields = extractMongooseFields(MongooseCommunitySchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Publication Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodPublicationSchema);
      const mongooseFields = extractMongooseFields(MongoosePublicationSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Comment Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodCommentSchema);
      const mongooseFields = extractMongooseFields(MongooseCommentSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Vote Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodVoteSchema);
      const mongooseFields = extractMongooseFields(MongooseVoteSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Poll Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodPollSchema);
      const mongooseFields = extractMongooseFields(MongoosePollSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Wallet Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodWalletSchema);
      const mongooseFields = extractMongooseFields(MongooseWalletSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });

  describe('Transaction Schema', () => {
    it('should align Zod and Mongoose schemas', () => {
      const zodFields = extractZodFields(ZodTransactionSchema);
      const mongooseFields = extractMongooseFields(MongooseTransactionSchema);
      const comparison = compareFields(zodFields, mongooseFields);

      expect(comparison.missingInMongoose).toEqual([]);
    });
  });
});

