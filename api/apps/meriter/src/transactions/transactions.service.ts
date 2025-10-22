import { Injectable, Logger } from '@nestjs/common';
import { Document, Model } from 'mongoose';

import { Transaction } from './model/transaction.model';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { TransactionForPublicationDTO } from './model/transaction-for-publication.dto';
import { PublicationsService } from '../publications/publications.service';
import * as mongoose from 'mongoose';
import { TransactionForTransactionDTO } from './model/transaction-for-transaction.dto';
import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';
import { HashtagsService } from '../hashtags/hashtags.service';
import { uid } from 'uid';
import { WithdrawFromPublicationDTO } from './model/withdraw-from-publication.dto';
import { WithdrawFromTransactionDTO } from './model/withdraw-from-transaction.dto';
import { Agreement } from '@common/abstracts/agreements/schema/agreement.schema';
import { UpdatesConductorsService } from '../updates-conductors/updates-conductors.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  model: Model<Transaction & Document>;

  constructor(
    private walletsService: WalletsService,
    private agreementsService: AgreementsService,
    private publicationsService: PublicationsService,
    private usersService: UsersService,
    private hashtagsService: HashtagsService,
    private updatesConductorsService: UpdatesConductorsService,
  ) {
    this.model = (this.agreementsService.model as unknown) as Model<
      Transaction & Document
    >;
  }

  async rankInHashtag(hashtagUid: string) {
    const aggr = await this.agreementsService.model
      .aggregate([
        { $match: { $or:[{spacesActorUris: 'actor.hashtag://' + hashtagUid,type:"forTransaction" },{spacesActorUris: 'actor.hashtag://' + hashtagUid,type:"forPublication" }]} },
        {
          $group: {
            _id: '$subjectsActorUris',
            rating: {
              $sum: '$meta.amounts.total',
            },
          },
        },
      ])
      .sort({ rating: -1 });

    //console.log('actor.hashtag://' + hashtagUid, aggr);

    const ids = aggr
      .map((r) =>
        parseInt(r._id?.[0]?.replace('actor.user://telegram', '')) > 0
          ? 'telegram://' + r._id?.[0]?.replace('actor.user://telegram', '')
          : undefined,
      )
      .filter((i) => i);

    /*
    $cond: {
                            if: "$directionPlus",
                            then: "$amountTotal",
                            else: { $subtract: [0, "$amountTotal"] },
                        },
    */
    const users = await this.usersService.model.find({
      identities: { $elemMatch: { $in: ids } },
    });

    const rank = aggr
      .map((a) => {
        const user = users.find(
          (u) =>
            u?.identities?.[0]?.replace('telegram://', '') ===
            a._id?.[0]?.replace('actor.user://telegram', ''),
        );
        if (user && user.profile?.name)
          return {
            name: user.profile?.name,
            tgUserId: user?.identities?.[0]?.replace('telegram://', ''),
            rating: a.rating,
          };
      })
      .filter((a) => a);
    //const space = await Space.findOne({ slug: spaceSlug });

    return {
      rank,
      aggr,
      users,
    };
  }

  findInHashtag(hashtagId, positive: boolean | undefined = undefined) {
    if (positive == undefined)
      return this.model.find({
        spacesActorUris: 'actor.hashtag://' + hashtagId,
      });
    else {
      return this.model.find({
        spacesActorUris: 'actor.hashtag://' + hashtagId,
        'meta.amounts.total': positive ? { $gte: 0 } : { $lte: 0 },
      });
    }
  }
  findForTransaction(transactionId, positive: boolean | undefined = undefined) {
    if (positive == undefined)
      return this.model.find({
        focusAssetUri: 'agreement.transaction://' + transactionId,
      });
    else {
      return this.model.find({
        focusAssetUri: 'agreement.transaction://' + transactionId,
        'meta.metrics.sum': positive ? { $gte: 0 } : { $lte: 0 },
      });
    }
  }
  findForPublication(publicationId, positive: boolean | undefined = undefined) {
    if (positive == undefined)
      return this.model.find({
        focusAssetUri: 'asset.publication://' + publicationId,
      });
    else {
      return this.model.find({
        focusAssetUri: 'asset.publication://' + publicationId,
        'meta.metrics.sum': positive ? { $gte: 0 } : { $ne: false },
      });
    }
  }
  findFromUserTgId(tgUserId, positive: boolean | undefined = undefined) {
    if (true)
      return this.model.find({
        initiatorsActorUris: 'actor.user://telegram' + tgUserId,
      });
    else {
      return this.model.find(
        {
          initiatorsActorUris: 'actor.user://telegram' + tgUserId,
          'meta.metrics.sum': positive ? { $gte: 0 } : { $ne: false },
        },
        {},
        { sort: { 'meta.metrics.sum': -1 } },
      );
    }
  }

  findToUserTgId(tgUserId, positive: boolean | undefined = undefined) {
    if (true)
      return this.model
        .find({
          subjectsActorUris: 'actor.user://telegram' + tgUserId,
        })
        .sort({ _id: -1 });
    else {
      return this.model.find(
        {
          subjectsActorUris: 'actor.user://telegram' + tgUserId,
          'meta.metrics.sum': positive ? { $gte: 0 } : { $ne: false },
        },
        {},
        { sort: { 'meta.metrics.sum': -1 } },
      );
    }
  }

  async approveAndSplitAmounts(
    amount: number,
    telegramUserId: string,
    inHashtagSlug: string,
    currencyOfCommunityTgChatId: string,
  ) {
    const free = await this.getFreeLimit(telegramUserId, inHashtagSlug);

    const available = await this.walletsService.getValue({
      telegramUserId,
      currencyOfCommunityTgChatId,
    });

    if (Math.abs(amount) > free + available) {
      throw 'not enough points';
    }
    if (amount < 0) return { personal: amount, free: 0 };

    if (free >= amount) {
      return { personal: 0, free: amount };
    } else {
      return { personal: amount - free, free };
    }
  }

  async createForPublication(dto: TransactionForPublicationDTO) {
    const publication = await this.publicationsService.model.findOne({
      uid: dto.forPublicationUid,
    });

    const tgChatId = publication.meta.origin.telegramChatId;
    // Use beneficiary if present, otherwise use author
    const toUserTgId = publication.meta.beneficiary?.telegramId || publication.meta.author.telegramId;
    const hashtagSlug = publication.meta.hashtagSlug;

    if (!tgChatId) throw 'notgchatid';
    if (!toUserTgId) throw 'notouser';

    const { personal, free } = await this.approveAndSplitAmounts(
      dto.amount,
      dto.fromUserTgId,
      hashtagSlug,
      tgChatId,
    );

    const transactionId = new mongoose.Types.ObjectId();

    if (dto.fromUserTgId == toUserTgId) throw 'cannot vote for self';

    //const currency = getCurrencyOrGlobalFeed(tgChatId);
    const currency = tgChatId;

    //  const allow = await userJWTgetAccessToTgChatId(req, res, currency);
    // if (!allow) throw "not a member";

    const parentPublication = await this.publicationsService.model.findOne({
      uid: dto.forPublicationUid,
    });

    const subjectActorUri = 'actor.user://telegram' + toUserTgId;
    const initiatorActorUri = 'actor.user://telegram' + dto.fromUserTgId;
    const promiseUpdateConductor = this.updatesConductorsService.pushUpdate({
      actorUri: subjectActorUri,
      amount: dto.amount,
      currencyOfTgChatId: currency,
      forPublicationUid: dto.forPublicationUid,
      fromActorUri: initiatorActorUri,
    });
    const p1 = this.model.create({
      _id: transactionId,
      uid: uid(32),
      domainName: 'transaction',
      initiatorsActorUris: [initiatorActorUri],
      subjectsActorUris: [subjectActorUri],
      meta: {
        parentPublicationUri: dto.forPublicationUid,
        parentText: parentPublication.meta.comment,
        amounts: {
          free,
          personal,
          total: dto.amount,
          currencyOfCommunityTgChatId: tgChatId,
        },
        from: {
          telegramUserId: dto.fromUserTgId,
          telegramUserName: dto.fromUserTgName,
        },
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
        comment: dto.comment,
      },
      type: 'forPublication',
      focusAssetUri: 'asset.publication://' + dto.forPublicationUid,
      spacesActorUris: ['actor.hashtag://slug' + hashtagSlug],
      createdAt: new Date(),
    });

    const p2 = this.publicationsService.deltaByUid(
      dto.forPublicationUid,
      dto.amount,
    );
    const p3 = this.walletsService.delta(-Math.abs(personal), {
      telegramUserId: dto.fromUserTgId,
      currencyOfCommunityTgChatId: currency,
    });
    const promiseInitWallet = this.walletsService.initWallet(0, {
      currencyOfCommunityTgChatId: tgChatId,
      telegramUserId: dto.fromUserTgId,
    });
    await Promise.all([p1, p2, p3, promiseUpdateConductor, promiseInitWallet]);
    return transactionId;
  }

  async createForTransaction(dto: TransactionForTransactionDTO) {
    const publication = await this.publicationsService.model.findOne({
      uid: dto.inPublicationUid,
    });

    const transaction = await this.model.findOne({
      uid: dto.forTransactionUid,
    });

    const hashtagSlug = publication.meta.hashtagSlug;
    const tgChatId = publication.meta.origin.telegramChatId;

    if (!tgChatId) throw 'notgchatid';

    let toUserTgId = '';
    const initiatorUri = transaction.initiatorsActorUris[0];
    toUserTgId = await this.usersService.actorsService.getTelegramByActorUri(
      initiatorUri,
    );

    if (initiatorUri.match('telegram'))
      toUserTgId = initiatorUri.replace('actor.user://telegram', '');

    const { personal, free } = await this.approveAndSplitAmounts(
      dto.amount,
      dto.fromUserTgId,
      hashtagSlug,
      tgChatId,
    );

    //const toUserTgId;
    if (dto.fromUserTgId == toUserTgId) throw 'cannot vote for self';

    //const currency = getCurrencyOrGlobalFeed(tgChatId);

    //const allow = await userJWTgetAccessToTgChatId(req, res, currency);
    //if (!allow) throw 'not a member';
    const transactionId = new mongoose.Types.ObjectId();

    const parentTransaction = await this.model.findOne({
      uid: dto.forTransactionUid,
    });

    const subjectActorUri = 'actor.user://telegram' + toUserTgId;
    const initiatorActorUri = 'actor.user://telegram' + dto.fromUserTgId;
    const promiseUpdateConductor = this.updatesConductorsService.pushUpdate({
      actorUri: subjectActorUri,
      amount: dto.amount,
      currencyOfTgChatId: tgChatId,
      forTransactionUid: dto.forTransactionUid,
      fromActorUri: initiatorActorUri,
    });
    const p1 = this.model.create({
      _id: transactionId,
      domainName: 'transaction',
      initiatorsActorUris: ['actor.user://telegram' + dto.fromUserTgId],
      subjectsActorUris: ['actor.user://telegram' + toUserTgId],
      uid: uid(32),
      meta: {
        parentPublicationUri: dto.inPublicationUid,
        parentText: parentTransaction.meta.comment,
        amounts: {
          free,
          personal,
          total: dto.amount,
          currencyOfCommunityTgChatId: tgChatId,
        },
        from: {
          telegramUserId: dto.fromUserTgId,
          telegramUserName: dto.fromUserTgName,
        },
        comment: dto.comment,
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
      },
      type: 'forTransaction',
      focusAssetUri: 'agreement.transaction://' + dto.forTransactionUid,
      spacesActorUris: ['actor.hashtag://slug' + hashtagSlug],
      createdAt: new Date(),
    });

    const p2 = this.deltaByUid(dto.forTransactionUid, dto.amount);
    const p3 = this.walletsService.delta(-Math.abs(personal), {
      telegramUserId: dto.fromUserTgId,
      currencyOfCommunityTgChatId: tgChatId,
    });

    const promiseInitWallet = this.walletsService.initWallet(0, {
      currencyOfCommunityTgChatId: tgChatId,
      telegramUserId: dto.fromUserTgId,
    });

    await Promise.all([p1, p2, p3, promiseUpdateConductor, promiseInitWallet]);
    return transactionId;
  }

  async withdrawFromPublication(dto: WithdrawFromPublicationDTO) {
    const publication = await this.publicationsService.model.findOne({
      uid: dto.forPublicationUid,
    });

    const tgChatId = publication.meta.origin.telegramChatId;
    const ownerTgId = publication.meta.author.telegramId;
    const hashtagSlug = publication.meta.hashtagSlug;

    if (!tgChatId) throw 'notgchatid';
    if (!ownerTgId) throw 'no owner';

    if (!(dto.userTgId === publication.meta.author.telegramId))
      throw 'not your publication';
    const balance = publication.meta.metrics.sum;
    if (dto.amount > 0 && balance < dto.amount)
      throw 'not enough funds on publication to withdraw';
    const funds = await this.walletsService.getValue({
      telegramUserId: dto.userTgId,
      currencyOfCommunityTgChatId: tgChatId,
    });
    if (dto.amount <= 0 && funds < Math.abs(dto.amount))
      throw 'not enough funds to top up';

    const p1 = this.model.create({
      domainName: 'transaction',
      initiatorsActorUris: ['actor.user://telegram' + dto.userTgId],
      subjectsActorUris: ['actor.user://telegram' + dto.userTgId],
      meta: {
        amounts: {
          free: 0,
          personal: dto.amount,
          total: dto.amount,
          currencyOfCommunityTgChatId: tgChatId,
        },
        from: {
          telegramUserId: dto.userTgId,
          telegramUserName: dto.userTgName,
        },
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
        comment: dto.comment,
      },
      type: 'withdrawalFromPublication',
      focusAssetUri: 'asset.publication://' + dto.forPublicationUid,
      spacesActorUris: ['actor.hashtag://slug' + hashtagSlug],
      createdAt: new Date(),
    });

    const p2 = this.publicationsService.deltaByUid(
      dto.forPublicationUid,
      -dto.amount,
    );
    const p3 = this.walletsService.delta(dto.amount, {
      telegramUserId: dto.userTgId,
      currencyOfCommunityTgChatId: tgChatId,
    });

    return await Promise.all([p1, p2, p3]);
  }

  async withdrawFromTransaction(dto: WithdrawFromTransactionDTO) {
    const transaction = await this.model.findOne({
      uid: dto.forTransactionUid,
    });

    const inPublicationUid = this.agreementsService.focusUriExtractUid(
      transaction.focusAssetUri[0],
    );
    const publication = await this.publicationsService.model.findOne({
      uid: transaction.meta.parentPublicationUri.replace(
        'agreement.transaction://slug',
        '',
      ),
    });

    const hashtagSlug = publication.meta.hashtagSlug;
    const tgChatId = publication.meta.origin.telegramChatId;

    if (!tgChatId) throw 'notgchatid';

    const initiatorUri = transaction.initiatorsActorUris[0];
    const transactionUserTgId = await this.usersService.actorsService.getTelegramByActorUri(
      initiatorUri,
    );

    if (!(dto.userTgId === transactionUserTgId)) throw 'not your transaction';

    const balance = transaction.meta.metrics.sum;
    if (dto.amount > 0 && balance < dto.amount)
      throw 'not enough funds on publication to withdraw';

    const funds = await this.walletsService.getValue({
      telegramUserId: dto.userTgId,
      currencyOfCommunityTgChatId: tgChatId,
    });
    if (dto.amount <= 0 && funds < Math.abs(dto.amount))
      throw 'not enough funds to top up';

    const p1 = this.model.create({
      domainName: 'transaction',
      initiatorsActorUris: ['actor.user://telegram' + dto.userTgId],
      subjectsActorUris: ['actor.user://telegram' + dto.userTgId],
      meta: {
        amounts: {
          free: 0,
          personal: dto.amount,
          total: dto.amount,
          currencyOfCommunityTgChatId: tgChatId,
        },
        from: {
          telegramUserId: dto.userTgId,
          telegramUserName: dto.userTgName,
        },
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
        comment: dto.comment,
      },
      type: 'withdrawalFromTransaction',
      focusAssetUri: 'agreement.transaction://' + dto.forTransactionUid,
      spacesActorUris: ['actor.hashtag://slug' + hashtagSlug],
      createdAt: new Date(),
    });

    const p2 = this.deltaByUid(dto.forTransactionUid, -dto.amount);

    const p3 = this.walletsService.delta(dto.amount, {
      telegramUserId: dto.userTgId,
      currencyOfCommunityTgChatId: tgChatId,
    });

    return await Promise.all([p1, p2, p3]);
  }

  async deltaByUid(uid: string, amount: number) {
    return amount > 0
      ? this.model.updateOne(
          { uid },
          {
            $inc: { 'meta.metrics.plus': amount, 'meta.metrics.sum': amount },
          },
        )
      : this.model.updateOne(
          { uid },
          {
            $inc: { 'meta.metrics.minus': -amount, 'meta.metrics.sum': amount },
          },
        );
  }

  async getFreeLimit(telegramUserId: string, inHashtag: string) {
    this.logger.log('getFreeLimit', telegramUserId, inHashtag)
    const hashtag = await this.hashtagsService.model.findOne({
      slug: inHashtag,
    });
    this.logger.log('hashtag slug:', hashtag?.slug)
    const parentTgChatId = hashtag.meta.parentTgChatId;


    const trans = await this.model.find({
      initiatorsActorUris: 'actor.user://telegram' + telegramUserId,
      'meta.amounts.currencyOfCommunityTgChatId': parentTgChatId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const used = trans && trans.reduce((p, c, i) => p + c.meta.amounts.free, 0);
    let freeMax = 10;
    const testTgChatId = '-377484156';
    const selfCompamyTgChatId = process.env.SELF_COMPANY_TG_CHAT_ID || '-1001225379816';
    const now = new Date();
    if (parentTgChatId == testTgChatId) {
      if (
        this.nowIsBetween(
          '29 June 2021 00:00 GMT+3',
          '29 June 2021 21:00 GMT+3',
        )
      )
        freeMax = 100;
    }
    if (parentTgChatId == selfCompamyTgChatId) {
      if (
        this.nowIsBetween(
          '30 June 2021 00:00 GMT+3',
          '30 June 2021 23:59 GMT+3',
        )
      )
        freeMax = 100;
      if (
        this.nowIsBetween(
          '31 July 2021 00:00 GMT+3',
          '31 July 2021 23:59 GMT+3',
        )
      )
        freeMax = 100;
      if (
        this.nowIsBetween(
          '31 August 2021 00:00 GMT+3',
          '31 August 2021 23:59 GMT+3',
        )
      )
        freeMax = 100;
    }

    return Math.max(freeMax - (used ?? 0), 0);
  }

  nowIsBetween(dateStr1, dateStr2) {
    const now = Date.now();
    //  console.log('now',now);
    //   console.log('date1',new Date(dateStr1),(new Date(dateStr1)).getTime());
    //    console.log('date2',new Date(dateStr2),(new Date(dateStr2)).getTime());

    return (
      new Date(dateStr1).getTime() < now && now < new Date(dateStr2).getTime()
    );
  }

  getUpdates(telegramUserId: string, limit = 20, skip = 0) {
    return this.model
      .find({
        subjectsActorUris: 'actor.user://telegram' + telegramUserId,
      })
      .sort({ _id: -1 })
      .lean();
  }
}
