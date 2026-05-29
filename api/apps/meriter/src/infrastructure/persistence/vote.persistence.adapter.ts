import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { buildOfficialBlockVoteTargetId } from '../../domain/common/document-official-vote.util';
import { VoteSchemaClass, VoteDocument } from '../../domain/models/vote/vote.schema';
import {
  VOTE_PERSISTENCE_PORT,
  type CreateVoteInput,
  type PublicationVotesQuery,
  type VotePersistencePort,
  type VotePersistenceSession,
  type VoteRecord,
} from '../../domain/ports/vote.persistence.port';
import { mapVoteDocumentToRecord } from './mappers/vote.mapper';

function sessionOpts(session?: VotePersistenceSession) {
  return session ? { session: session as ClientSession } : undefined;
}

@Injectable()
export class VotePersistenceAdapter implements VotePersistencePort {
  constructor(
    @InjectModel(VoteSchemaClass.name) private readonly voteModel: Model<VoteDocument>,
  ) {}

  async createVote(
    input: CreateVoteInput,
    session?: VotePersistenceSession,
  ): Promise<VoteRecord> {
    const voteArray = await this.voteModel.create(
      [
        {
          id: input.id,
          targetType: input.targetType,
          targetId: input.targetId,
          userId: input.userId,
          amountQuota: input.amountQuota,
          amountWallet: input.amountWallet,
          direction: input.direction,
          communityId: input.communityId,
          comment: input.comment,
          images: input.images,
          createdAt: input.createdAt,
        },
      ],
      sessionOpts(session),
    );
    return mapVoteDocumentToRecord(voteArray[0]);
  }

  async deleteVoteByUserTarget(
    userId: string,
    targetType: VoteRecord['targetType'],
    targetId: string,
  ): Promise<boolean> {
    const result = await this.voteModel.deleteOne({ userId, targetType, targetId });
    return result.deletedCount > 0;
  }

  async findVotesByUserId(userId: string, limit: number, skip: number): Promise<VoteRecord[]> {
    const rows = await this.voteModel
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findVoteById(voteId: string): Promise<VoteRecord | null> {
    const row = await this.voteModel.findOne({ id: voteId }).lean().exec();
    return row ? mapVoteDocumentToRecord(row) : null;
  }

  async findVotesByTarget(targetType: string, targetId: string): Promise<VoteRecord[]> {
    const rows = await this.voteModel.find({ targetType, targetId }).lean().exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findDocumentBlockPanelVotes(
    documentId: string,
    blockId: string,
    variantIds: string[],
  ): Promise<VoteRecord[]> {
    const officialTargetId = buildOfficialBlockVoteTargetId(documentId, blockId);
    const or: Array<Record<string, unknown>> = [
      { targetType: 'document-block-official', targetId: officialTargetId },
    ];
    if (variantIds.length > 0) {
      or.push({ targetType: 'document-variant', targetId: { $in: variantIds } });
    }
    const rows = await this.voteModel.find({ $or: or }).sort({ createdAt: -1 }).lean().exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findVotesOnVote(voteId: string): Promise<VoteRecord[]> {
    const rows = await this.voteModel
      .find({ targetType: 'vote', targetId: voteId })
      .lean()
      .exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findVotesOnVotes(voteIds: string[]): Promise<VoteRecord[]> {
    if (voteIds.length === 0) return [];
    const rows = await this.voteModel
      .find({ targetType: 'vote', targetId: { $in: voteIds } })
      .lean()
      .exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findVotesOnPublication(publicationId: string): Promise<VoteRecord[]> {
    const rows = await this.voteModel
      .find({ targetType: 'publication', targetId: publicationId })
      .lean()
      .exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async findPublicationVotes(query: PublicationVotesQuery): Promise<VoteRecord[]> {
    const {
      publicationId,
      limit = 50,
      skip = 0,
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = query;

    if (sortField === 'score') {
      const allVotes = await this.voteModel
        .find({ targetType: 'publication', targetId: publicationId })
        .lean()
        .exec();

      const voteIds = allVotes.map((v) => v.id);
      const votesOnVotes = await this.findVotesOnVotes(voteIds);
      const votesOnVotesMap = new Map<string, VoteRecord[]>();
      votesOnVotes.forEach((vote) => {
        const existing = votesOnVotesMap.get(vote.targetId) || [];
        existing.push(vote);
        votesOnVotesMap.set(vote.targetId, existing);
      });

      const votesWithScores = allVotes.map((vote) => ({
        vote,
        score: (votesOnVotesMap.get(vote.id) || []).reduce(
          (sum, r) => sum + (r.amountQuota + r.amountWallet),
          0,
        ),
      }));

      votesWithScores.sort((a, b) =>
        sortOrder === 'asc' ? a.score - b.score : b.score - a.score,
      );

      return votesWithScores.slice(skip, skip + limit).map((entry) => mapVoteDocumentToRecord(entry.vote));
    }

    const sortValue = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortValue };
    const rows = await this.voteModel
      .find({ targetType: 'publication', targetId: publicationId })
      .limit(limit)
      .skip(skip)
      .sort(sort as Record<string, 1 | -1>)
      .lean()
      .exec();
    return rows.map(mapVoteDocumentToRecord);
  }

  async hasUserVote(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const vote = await this.voteModel.findOne({ userId, targetType, targetId }).lean();
    return vote !== null;
  }

  async sumPositiveAmountsOnVote(voteId: string): Promise<number> {
    const result = await this.voteModel
      .aggregate([
        { $match: { targetType: 'vote', targetId: voteId } },
        { $project: { totalAmount: { $add: ['$amountQuota', '$amountWallet'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ])
      .exec();
    return (result && result[0] && result[0].total) || 0;
  }
}

export const votePersistenceProvider = {
  provide: VOTE_PERSISTENCE_PORT,
  useClass: VotePersistenceAdapter,
};
