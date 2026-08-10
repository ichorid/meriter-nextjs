import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, type PipelineStage } from 'mongoose';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import {
  INVESTMENT_PERSISTENCE_PORT,
  type InvestmentPersistencePort,
  type InvestmentPersistenceSession,
  type PublicationInvestmentRecord,
  type PortfolioAggregationRow,
} from '../../domain/ports/investment.persistence.port';

@Injectable()
export class InvestmentPersistenceAdapter implements InvestmentPersistencePort {
  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async findPublicationById(
    postId: string,
    session?: InvestmentPersistenceSession,
  ): Promise<PublicationInvestmentRecord | null> {
    const query = this.publicationModel.findOne({ id: postId }).lean();
    if (session) {
      query.session(session as ClientSession);
    }
    const row = await query.exec();
    return row ? (row as PublicationInvestmentRecord) : null;
  }

  async updatePublication(
    postId: string,
    update: {
      set?: Record<string, unknown>;
      inc?: Record<string, number>;
      push?: Record<string, unknown>;
    },
    session?: InvestmentPersistenceSession,
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (update.set && Object.keys(update.set).length > 0) {
      payload.$set = update.set;
    }
    if (update.inc && Object.keys(update.inc).length > 0) {
      payload.$inc = update.inc;
    }
    if (update.push && Object.keys(update.push).length > 0) {
      payload.$push = update.push;
    }
    const query = this.publicationModel.updateOne({ id: postId }, payload);
    if (session) {
      query.session(session as ClientSession);
    }
    await query.exec();
  }

  async findPublicationsByInvestor(
    userId: string,
  ): Promise<PublicationInvestmentRecord[]> {
    const rows = await this.publicationModel
      .find({
        'investments.investorId': userId,
        deleted: { $ne: true },
      })
      .lean()
      .exec();
    return rows as PublicationInvestmentRecord[];
  }

  async aggregatePortfolioByInvestor(
    userId: string,
    status?: 'active' | 'closed',
  ): Promise<PortfolioAggregationRow[]> {
    const filterMatch = status ? { status } : {};
    const pipeline: PipelineStage[] = [
      {
        $match: {
          'investments.investorId': userId,
          deleted: { $ne: true },
          ...filterMatch,
        },
      },
      {
        $addFields: {
          myInv: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$investments',
                  as: 'i',
                  cond: { $eq: ['$$i.investorId', userId] },
                },
              },
              0,
            ],
          },
        },
      },
      { $match: { myInv: { $ne: null } } },
      {
        $project: {
          id: 1,
          title: 1,
          authorId: 1,
          communityId: 1,
          status: 1,
          'metrics.score': 1,
          investmentPool: 1,
          investmentPoolTotal: 1,
          ttlExpiresAt: 1,
          closingSummary: 1,
          myInv: 1,
        },
      },
    ];
    const rows = await this.publicationModel
      .aggregate<PortfolioAggregationRow>(pipeline)
      .exec();
    return rows;
  }

  async updateInvestorEarnings(
    postId: string,
    investorId: string,
    amount: number,
    reason: string,
    date: Date,
    session?: InvestmentPersistenceSession,
  ): Promise<void> {
    const update = this.publicationModel.updateOne(
      { id: postId, 'investments.investorId': investorId },
      {
        $inc: { 'investments.$.totalEarnings': amount },
        $push: {
          'investments.$.earningsHistory': {
            amount,
            reason,
            date,
          },
        },
      },
    );
    if (session) {
      update.session(session as ClientSession);
    }
    await update.exec();
  }
}

export const investmentPersistenceProvider = {
  provide: INVESTMENT_PERSISTENCE_PORT,
  useClass: InvestmentPersistenceAdapter,
};
