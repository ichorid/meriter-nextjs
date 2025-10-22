import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  UpdatesConductor,
  UpdatesConductorDocument,
} from './model/updates-conductor.schema';
import { Model } from 'mongoose';
import { fillDefined } from '@common/lambdas/pure/objects';
import { TgBotsService } from '../tg-bots/tg-bots.service';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { URL } from '../config';

export class PushUpdateDto {
  actorUri: string;
  currencyOfTgChatId: string;
  amount: number;
  forTransactionUid?: string;
  forPublicationUid?: string;
  fromActorUri?: string;
}

@Injectable()
export class UpdatesConductorsService {
  private readonly logger = new Logger(UpdatesConductorsService.name);
  model: Model<UpdatesConductorDocument>;

  constructor(
    @InjectModel(UpdatesConductor.name, 'default')
    updatesConductorModel: Model<UpdatesConductorDocument>,

    private readonly tgBotsService: TgBotsService,
  ) {
    this.model = updatesConductorModel;
  }

  async pushUpdate(dto: PushUpdateDto) {
    const upd = await this.model.findOneAndUpdate(
      {
        actorUri: dto.actorUri,
        //   currencyOfTgChatId: dto.currencyOfTgChatId,
      },
      {
        actorUri: dto.actorUri,
        //  currencyOfTgChatId: dto.currencyOfTgChatId,
        $inc: {
          counterPlus: dto.amount > 0 ? dto.amount : 0,
          counterMinus: dto.amount < 0 ? -dto.amount : 0,
          counterSum: dto.amount,
        },
        $addToSet: {
          publicationUids: dto.forPublicationUid,
          commentsUids: dto.forTransactionUid,
          votersActorUris: dto.fromActorUri,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    await Promise.all([
      this.model.updateMany(
        { nextUpdateAfter: { $exists: false } },
        { $set: { nextUpdateAfter: new Date() } },
      ),
      this.model.updateMany(
        { updateFrequencyMs: { $exists: false } },
        { $set: { updateFrequencyMs: 1000 * 60 * 60 } },
      ),
    ]);
  }
  // @Cron('* * * * *')
  async testCron() {
    this.logger.log('test cron' + Date.now());
  }
  @Cron('* * * * *')
  async maybeTrigger() {
    const updateList = await this.model.find({
      nextUpdateAfter: { $lte: new Date() },
    });

    // console.log(updateList);

    const promisesTgSend = [];
    const promisesResetConductor = updateList
      .map((u) => u.toObject())
      .map((upd) => {
        const tgUserId = (upd.actorUri ?? '').replace(
          'actor.user://telegram',
          '',
        );
        if (tgUserId) {
          if (
            upd.counterPlus !== 0 ||
            upd.counterMinus !== 0 ||
            upd.counterSum !== 0
          ) {
            this.logger.log(
              upd,
              upd.counterPlus !== 0 ||
                upd.counterMinus !== 0 ||
                upd.counterSum !== 0,
              typeof upd.counterSum,
            );
            const publicationsN = upd.publicationUids.filter(Boolean).length;
            const transactionsN = upd.commentsUids.filter(Boolean).length;
            const actorsN = upd.votersActorUris.filter(Boolean).length;
            const text = `Для Вас есть обновления!
Активность ${publicationsN} постов и ${transactionsN} комментариев:
Пришла обратная связь от  ${actorsN} пользователей, из них плюсов ${upd.counterPlus} и ${upd.counterMinus} минусов
Посмотреть подробнее https://t.me/meriter_pro_bot?startapp=updates`;
            const tgPromise = this.tgBotsService.tgSend({
              tgChatId: tgUserId,

              text,
            });
            promisesTgSend.push(tgPromise);

            const nextUpdateAfter = new Date(
              Date.now() + parseInt(String(upd.updateFrequencyMs ?? 1000 * 60)),
            );

            const updPromise = this.model.updateOne(
              { _id: upd._id },
              {
                $set: {
                  publicationUids: [],
                  commentsUids: [],
                  votersActorUris: [],
                  counterSum: 0,
                  counterMinus: 0,
                  counterPlus: 0,
                  nextUpdateAfter,
                },
              },
              { setDefaultsOnInsert: true },
            );
            return updPromise;
          }
        }
      });

    const r = await Promise.all([
      Promise.all(promisesResetConductor),
      Promise.all(promisesTgSend),
    ]);

    //  console.log('cron tick', r);
    return;
  }

  setFrequency(actorUri: string, updateFrequencyMs: number) {
    const nextUpdateAfter = new Date(
      Date.now() + parseInt(String(updateFrequencyMs ?? 1000 * 60)),
    );
    return this.model.updateMany(
      { actorUri },
      { updateFrequencyMs, nextUpdateAfter },
      { upsert: true },
    );
  }
  async getFrequency(actorUri: string) {
    const fr = await this.model.findOne({ actorUri });
    if (!fr) this.logger.warn('freq not found for ',actorUri)
    return fr?.updateFrequencyMs;
  }
}
