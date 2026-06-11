import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import {
  MERIT_HISTORY_FILTER_KEYS,
  buildCommunityMeritHistoryTransactionMatch,
  buildMeritHistoryTransactionMatch,
  meritHistoryCategoryMongoExprOnRtVar,
  meritHistorySignedAmountMongoExpr,
  meritHistoryUtcCalendarRange,
  type MeritHistoryDashboardPeriodDays,
  type MeritHistoryFilterKey,
} from '../../domain/common/helpers/wallet-transaction-history';
import {
  TransactionSchemaClass,
  TransactionDocument,
} from '../../domain/models/transaction/transaction.schema';
import { WalletSchemaClass, WalletDocument } from '../../domain/models/wallet/wallet.schema';
import type { WalletSnapshot } from '../../domain/aggregates/wallet/wallet.entity';
import {
  WALLET_PERSISTENCE_PORT,
  type CommunityMeritHistoryQueryResult,
  type CreateWalletTransactionInput,
  type MeritHistoryDashboardAggregateResult,
  type WalletOwnerRef,
  type WalletPersistencePort,
  type WalletPersistenceSession,
  type WalletTransactionRecord,
} from '../../domain/ports/wallet.persistence.port';
import {
  mapTransactionDocumentToRecord,
  mapWalletDocumentToSnapshot,
  mapWalletSnapshotToDocument,
} from './mappers/wallet.mapper';

function sessionOpts(session?: WalletPersistenceSession) {
  return session ? { session: session as ClientSession } : {};
}

@Injectable()
export class WalletPersistenceAdapter implements WalletPersistencePort {
  constructor(
    @InjectModel(WalletSchemaClass.name) private readonly walletModel: Model<WalletDocument>,
    @InjectModel(TransactionSchemaClass.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectConnection() private readonly mongoose: Connection,
  ) {}

  async startSession(): Promise<WalletPersistenceSession> {
    return this.mongoose.startSession();
  }

  async findWalletByUserAndCommunity(
    userId: string,
    communityId: string,
  ): Promise<WalletSnapshot | null> {
    const doc = await this.walletModel.findOne({ userId, communityId }).lean().exec();
    return doc ? mapWalletDocumentToSnapshot(doc) : null;
  }

  async insertWallet(
    snapshot: WalletSnapshot,
    session?: WalletPersistenceSession,
  ): Promise<void> {
    await this.walletModel.create([mapWalletSnapshotToDocument(snapshot)], sessionOpts(session));
  }

  async updateWallet(
    snapshot: WalletSnapshot,
    session?: WalletPersistenceSession,
  ): Promise<void> {
    await this.walletModel.updateOne(
      { id: snapshot.id },
      { $set: mapWalletSnapshotToDocument(snapshot) },
      sessionOpts(session),
    );
  }

  async debitWalletIfSufficient(
    userId: string,
    communityId: string,
    amount: number,
    session?: WalletPersistenceSession,
  ): Promise<WalletSnapshot | null> {
    const doc = await this.walletModel
      .findOneAndUpdate(
        { userId, communityId, balance: { $gte: amount } },
        { $inc: { balance: -amount }, $set: { lastUpdated: new Date() } },
        { new: true, ...sessionOpts(session) },
      )
      .lean()
      .exec();
    return doc ? mapWalletDocumentToSnapshot(doc) : null;
  }

  async deleteWalletById(walletId: string): Promise<void> {
    await this.walletModel.deleteOne({ id: walletId });
  }

  async findWalletsByUserId(userId: string): Promise<WalletSnapshot[]> {
    const docs = await this.walletModel.find({ userId }).lean().exec();
    return docs.map(mapWalletDocumentToSnapshot);
  }

  async findGlobalWalletIdByUserId(userId: string): Promise<string | null> {
    const wallet = await this.walletModel
      .findOne({ userId, communityId: GLOBAL_COMMUNITY_ID })
      .select('id')
      .lean()
      .exec();
    return wallet?.id ?? null;
  }

  async findWalletOwnersByCommunityId(communityId: string): Promise<WalletOwnerRef[]> {
    const rows = await this.walletModel.find({ communityId }).select('id userId').lean().exec();
    return rows.map((row) => ({ id: String(row.id), userId: String(row.userId) }));
  }

  async hasPositiveBalanceForCommunity(communityId: string): Promise<boolean> {
    const row = await this.walletModel
      .findOne({ communityId, balance: { $gt: 0 } })
      .select('id')
      .lean()
      .exec();
    return row != null;
  }

  async findWalletOwnersByIds(walletIds: string[]): Promise<WalletOwnerRef[]> {
    const rows = await this.walletModel
      .find({ id: { $in: walletIds } })
      .select('id userId')
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row.id), userId: String(row.userId) }));
  }

  async findTransactionByWalletAndReferenceType(
    walletId: string,
    referenceType: string,
  ): Promise<WalletTransactionRecord | null> {
    const doc = await this.transactionModel
      .findOne({ walletId, referenceType })
      .lean()
      .exec();
    return doc ? mapTransactionDocumentToRecord(doc) : null;
  }

  async insertTransaction(
    input: CreateWalletTransactionInput,
    session?: WalletPersistenceSession,
  ): Promise<void> {
    await this.transactionModel.create([input], sessionOpts(session));
  }

  async deleteTransactionsByWalletId(walletId: string): Promise<void> {
    await this.transactionModel.deleteMany({ walletId });
  }

  async findTransactionsByWalletId(
    walletId: string,
    limit: number,
    skip: number,
  ): Promise<WalletTransactionRecord[]> {
    const rows = await this.transactionModel
      .find({ walletId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows.map(mapTransactionDocumentToRecord);
  }

  async countMeritHistoryTransactions(
    walletId: string,
    category: MeritHistoryFilterKey,
  ): Promise<number> {
    const filter = buildMeritHistoryTransactionMatch(walletId, category);
    return this.transactionModel.countDocuments(filter);
  }

  async findMeritHistoryTransactions(
    walletId: string,
    category: MeritHistoryFilterKey,
    limit: number,
    skip: number,
  ): Promise<WalletTransactionRecord[]> {
    const filter = buildMeritHistoryTransactionMatch(walletId, category);
    const rows = await this.transactionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    return rows.map(mapTransactionDocumentToRecord);
  }

  async sumWithdrawnByReference(referenceType: string, referenceId: string): Promise<number> {
    const result = await this.transactionModel
      .aggregate([
        { $match: { referenceType, referenceId, type: 'withdrawal' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    return (result && result[0] && result[0].total) || 0;
  }

  async sumProjectInvestorPayoutCredits(
    walletId: string,
    projectIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (projectIds.length === 0) return result;

    const rows = await this.transactionModel
      .aggregate<{ _id: string; sum: number }>([
        {
          $match: {
            walletId,
            type: 'deposit',
            referenceType: 'project_payout',
            referenceId: { $in: projectIds },
            description: { $regex: /\(investor\)\s*$/ },
          },
        },
        { $group: { _id: '$referenceId', sum: { $sum: '$amount' } } },
      ])
      .exec();

    for (const row of rows) {
      if (row._id) result.set(row._id, row.sum);
    }
    return result;
  }

  async aggregateMeritHistoryDashboard(
    walletId: string,
    category: MeritHistoryFilterKey,
    periodDays: MeritHistoryDashboardPeriodDays,
  ): Promise<MeritHistoryDashboardAggregateResult> {
    const emptyKpis = { inflow: 0, outflow: 0, net: 0, count: 0 };
    const range = periodDays === 'all' ? undefined : meritHistoryUtcCalendarRange(periodDays);
    const match = buildMeritHistoryTransactionMatch(walletId, category, range);
    const signedExpr = meritHistorySignedAmountMongoExpr();
    const roundMerits = (n: number) => Math.round(n * 100) / 100;

    const [facetRow] = await this.transactionModel
      .aggregate<{
        summary: Array<{
          inflow: number;
          outflow: number;
          net: number;
          count: number;
        }>;
        byDay: Array<{ _id: string; net: number }>;
      }>([
        { $match: match },
        { $addFields: { _signed: signedExpr } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  inflow: {
                    $sum: { $cond: [{ $gt: ['$_signed', 0] }, '$_signed', 0] },
                  },
                  outflow: {
                    $sum: {
                      $cond: [
                        { $lt: ['$_signed', 0] },
                        { $multiply: ['$_signed', -1] },
                        0,
                      ],
                    },
                  },
                  net: { $sum: '$_signed' },
                  count: { $sum: 1 },
                },
              },
            ],
            byDay: [
              {
                $addFields: {
                  _day: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                      timezone: 'UTC',
                    },
                  },
                },
              },
              { $group: { _id: '$_day', net: { $sum: '$_signed' } } },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])
      .exec();

    const summary = facetRow?.summary?.[0];
    const kpis = summary
      ? {
          inflow: roundMerits(summary.inflow ?? 0),
          outflow: roundMerits(summary.outflow ?? 0),
          net: roundMerits(summary.net ?? 0),
          count: Math.trunc(summary.count ?? 0),
        }
      : emptyKpis;

    const series = (facetRow?.byDay ?? []).map((d) => ({
      date: d._id,
      net: roundMerits(d.net ?? 0),
    }));

    let breakdown: MeritHistoryDashboardAggregateResult['breakdown'];
    if (category === 'all') {
      const allMatch = buildMeritHistoryTransactionMatch(walletId, 'all', range);
      const catExpr = meritHistoryCategoryMongoExprOnRtVar();
      const rows = await this.transactionModel
        .aggregate<{
          _id: string;
          net: number;
          inPos: number;
          outNeg: number;
          count: number;
        }>([
          { $match: allMatch },
          { $addFields: { _signed: signedExpr } },
          { $addFields: { _bucket: catExpr } },
          {
            $group: {
              _id: '$_bucket',
              net: { $sum: '$_signed' },
              inPos: {
                $sum: { $cond: [{ $gt: ['$_signed', 0] }, '$_signed', 0] },
              },
              outNeg: {
                $sum: {
                  $cond: [
                    { $lt: ['$_signed', 0] },
                    { $multiply: ['$_signed', -1] },
                    0,
                  ],
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec();

      const byCat = new Map(rows.map((r) => [r._id, r]));
      const ordered: NonNullable<MeritHistoryDashboardAggregateResult['breakdown']> = [];
      for (const key of MERIT_HISTORY_FILTER_KEYS) {
        if (key === 'all') continue;
        const r = byCat.get(key);
        const net = roundMerits(r?.net ?? 0);
        const inPos = r?.inPos ?? 0;
        const outNeg = r?.outNeg ?? 0;
        const grossVolume = roundMerits(inPos + outNeg);
        const count = Math.trunc(r?.count ?? 0);
        if (net === 0 && grossVolume === 0 && count === 0) continue;
        ordered.push({ category: key, net, grossVolume, count });
      }
      breakdown = ordered;
    }

    return { kpis, series, breakdown };
  }

  async findCommunityMeritHistoryTransactions(
    contextCommunityId: string,
    category: MeritHistoryFilterKey,
    limit: number,
    skip: number,
  ): Promise<CommunityMeritHistoryQueryResult> {
    const walletRows = await this.findWalletOwnersByCommunityId(contextCommunityId);
    const walletIds = walletRows.map((w) => w.id);
    const walletIdToUserId = new Map(walletRows.map((w) => [w.id, w.userId]));

    const db = this.mongoose.db;
    if (!db) {
      return { data: [], total: 0, walletOwnerByTxId: new Map() };
    }

    const meritIds = (await db
      .collection('merit_transfers')
      .distinct('id', { communityContextId: contextCommunityId })) as string[];

    const match = buildCommunityMeritHistoryTransactionMatch(walletIds, meritIds, category);

    const [total, rows] = await Promise.all([
      this.transactionModel.countDocuments(match),
      this.transactionModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    ]);

    const data = rows.map(mapTransactionDocumentToRecord);
    const walletOwnerByTxId = new Map<string, string>();
    for (const tx of data) {
      const uid = walletIdToUserId.get(tx.walletId);
      if (uid) walletOwnerByTxId.set(tx.id, uid);
    }

    const missingWalletIds = [
      ...new Set(data.filter((tx) => !walletOwnerByTxId.has(tx.id)).map((tx) => tx.walletId)),
    ];
    if (missingWalletIds.length > 0) {
      const extraRows = await this.findWalletOwnersByIds(missingWalletIds);
      const extraByWid = new Map(extraRows.map((r) => [r.id, r.userId]));
      for (const tx of data) {
        if (!walletOwnerByTxId.has(tx.id)) {
          const uid = extraByWid.get(tx.walletId);
          if (uid) walletOwnerByTxId.set(tx.id, uid);
        }
      }
    }

    return { data, total, walletOwnerByTxId };
  }
}

export const walletPersistenceProvider = {
  provide: WALLET_PERSISTENCE_PORT,
  useClass: WalletPersistenceAdapter,
};
