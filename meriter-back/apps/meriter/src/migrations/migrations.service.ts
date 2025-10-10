import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  mapOldTgChatToTgChat,
  OldEntity,
  OldEntityDocument,
  OldTgChat,
  OldTgChatDocument,
} from './schemas/old-tg-chat.schema';

import {
  mapOldPublicationToPublication,
  OldPublication,
  OldPublicationDocument,
} from './schemas/old-publication.schema';
import {
  mapOldTransactionToTransaction,
  OldTransaction,
  OldTransactionDocument,
} from './schemas/old-transaction.schema';
import {
  mapOldUserToUser,
  OldUser,
  OldUserData,
  OldUserDataDocument,
  OldUserDocument,
} from './schemas/old-user.schema';
import {
  mapOldSpaceToHashtag,
  OldSpace,
  OldSpaceDocument,
} from './schemas/old-space.schema';
import {
  mapOldWalletToWallet,
  OldWallet,
  OldWalletDocument,
} from './schemas/old-wallet.schema';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { AssetsService } from '@common/abstracts/assets/assets.service';
import { CountersService } from '@common/abstracts/counters/counters.service';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { Transaction } from '../transactions/model/transaction.model';

@Injectable()
export class MigrationsService {
  constructor(
    @InjectModel(OldTgChat.name)
    private oldTgChatModel: Model<OldTgChatDocument>,

    @InjectModel(OldPublication.name)
    private oldPublicationModel: Model<OldPublicationDocument>,

    @InjectModel(OldTransaction.name)
    private oldTransactionModel: Model<OldTransactionDocument>,

    @InjectModel(OldUser.name)
    private oldUserModel: Model<OldUserDocument>,
    @InjectModel(OldUserData.name)
    private oldUserDataModel: Model<OldUserDataDocument>,

    @InjectModel(OldSpace.name)
    private oldSpaceModel: Model<OldSpaceDocument>,

    @InjectModel(OldWallet.name)
    private oldWalletModel: Model<OldWalletDocument>,

    @InjectModel(OldEntity.name)
    private oldEntityModel: Model<OldEntityDocument>,

    private actorsService: ActorsService,
    private assetsService: AssetsService,
    private countersService: CountersService,
    private agreementsService: AgreementsService,
  ) /*private actorsService: ActorsService /*  private assetsService: AssetsService,
    private countersService: CountersService,
    private agreementsService: AgreementsService,*/ {}
  controller() {}

  wipeActors() {
    return this.actorsService.__testCleanup();
  }
  wipeAssets() {
    return this.assetsService.__testCleanup();
  }
  wipeCounters() {
    return this.countersService.__testCleanup();
  }
  wipeAgreements() {
    return this.agreementsService.__testCleanup();
  }
  async migrateTgChats() {
    const chats = await this.oldTgChatModel.find({});

    const p = [];
    for (const chat of chats) {
      const actor = mapOldTgChatToTgChat(chat.toObject(), 'meritercorpbot', 10);
      p.push(this.actorsService.upsert('tg-chat', { uid: actor.uid }, actor));
    }
    await Promise.all(p);
  }

  async migrateEntities() {
    const entities = await this.oldEntityModel.find({});

    const p = [];
    for (const ent of entities) {
      const chatId = ent.tgChatIds[0];
      p.push(
        this.actorsService.upsert(
          'tg-chat',
          { identities: 'telegram://' + chatId },
          {
            'meta.currencyNames': Object.entries(ent.currencyNames).map(
              ([k, v]) => v,
            ),
            'meta.dailyEmission': 10,
            'meta.iconUrl': ent.icon,
          },
        ),
      );
    }
    await Promise.all(p);
  }

  async migrateUsers() {
    const users = await this.oldUserModel.find({});

    const p = [];
    for (const user of users) {
      const actor = mapOldUserToUser(user.toObject());
      p.push(this.actorsService.upsert('user', { token: actor.token }, actor));
    }
    await Promise.all(p);
  }

  async migrateUserDatas() {
    const userdatas = await this.oldUserDataModel.find({});

    const p = [];
    for (const userdata of userdatas) {
      p.push(
        this.actorsService.upsert(
          'user',
          { identities: 'telegram://' + userdata.telegramUserId },
          {
            profile: {
              name: [userdata.firstName ?? '', userdata.lastName ?? ''].join(
                ' ',
              ),

              avatarUrl: userdata.avatarUrl,
            },
          },
        ),
      );
    }
    await Promise.all(p);
  }

  async migrateSpaces() {
    const spaces = await this.oldSpaceModel.find({});

    const p = [];
    for (const space of spaces) {
      const actor = mapOldSpaceToHashtag(space.toObject());
      p.push(this.actorsService.upsert('hashtag', { slug: actor.slug }, actor));
    }
    await Promise.all(p);
  }

  async migrateWallets() {
    const wallets = await this.oldWalletModel.find({});

    const p = [];
    for (const wallet of wallets) {
      const counter = mapOldWalletToWallet(wallet.toObject());
      p.push(
        this.countersService.pushToCounter(
          'wallet',
          counter.value,
          counter.meta,
        ),
      );
    }
    await Promise.all(p);
  }

  async migratePublications() {
    const publications = await this.oldPublicationModel.find({});

    const p = [];
    for (const publication of publications) {
      const asset = mapOldPublicationToPublication(publication.toObject());

      p.push(
        this.assetsService.upsert('publication', { uid: asset.uid }, asset),
      );
    }
    await Promise.all(p);
  }

  async migrateTransactions() {
    const transactions = await this.oldTransactionModel.find({});
    const p = [];
    for (const transaction of transactions) {
      const agreement = mapOldTransactionToTransaction(transaction.toObject());
      this.agreementsService.upsert(
        'transactions',
        { uid: agreement.uid },
        agreement,
      );
      //p.push(this.assetsService.upsert('publication',{uid:asset.uid},asset))
    }
    await Promise.all(p);
  }

  async changeTgChatId(from, to) {
    await this.actorsService.model.updateMany(
      { identities: `telegram://${from}` },
      { identities: [`telegram://${to}`] },
    );
    await this.actorsService.model.updateMany(
      { 'meta.parentTgChatId': `${from}` },
      { 'meta.parentTgChatId': `${to}` },
    );
    await this.actorsService.model.updateMany(
      { tags: `${from}` },
      { $addToSet: { tags: `${to}` } },
    );
    await this.agreementsService.model.updateMany(
      { 'meta.amounts.currencyOfCommunityTgChatId': `${from}` },
      { 'meta.amounts.currencyOfCommunityTgChatId': `${to}` },
    );
    await this.assetsService.model.updateMany(
      { 'meta.origin.telegramChatId': `${from}` },
      { 'meta.origin.telegramChatId': `${to}` },
    );
    await this.countersService.model.updateMany(
      { 'meta.currencyOfCommunityTgChatId': `${from}` },
      { 'meta.currencyOfCommunityTgChatId': `${to}` },
    );
  }
}
