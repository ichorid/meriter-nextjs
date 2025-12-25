import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  UpdatesConductorSchemaClass,
  UpdatesConductorDocument,
} from './model/updates-conductor.schema';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { UserSettingsService } from '../domain/services/user-settings.service';
import { UserUpdatesService } from '../domain/services/user-updates.service';

export class PushUpdateDto {
  actorUri!: string;
  currencyOfTgChatId!: string;
  amount!: number;
  forTransactionUid?: string;
  forPublicationUid?: string;
  fromActorUri?: string;
}

@Injectable()
export class UpdatesConductorsService {
  private readonly logger = new Logger(UpdatesConductorsService.name);
  model: Model<UpdatesConductorDocument>;

  constructor(
    @InjectModel(UpdatesConductorSchemaClass.name)
    updatesConductorModel: Model<UpdatesConductorDocument>,

    private readonly userSettingsService: UserSettingsService,
    private readonly userUpdatesService: UserUpdatesService,
  ) {
    this.model = updatesConductorModel;
  }

  async pushUpdate(dto: PushUpdateDto) {
    const _upd = await this.model.findOneAndUpdate(
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
  @Cron('0 * * * *')
  async maybeTrigger() {
    // Hourly batch using period boundaries (UTC)
    const to = new Date();
    to.setUTCMinutes(0, 0, 0);
    const from = new Date(to.getTime() - 60 * 60 * 1000);

    // Users with hourly setting
    const hourlyUsers = await (this as any).userSettingsService['model']
      .find({ updatesFrequency: 'hourly' })
      .lean();
    for (const u of hourlyUsers) {
      const events = await this.userUpdatesService.getUserUpdateEvents(u.userId, from, to);
      if (events.length > 0) {
        // Telegram notifications are disabled in this project; skip sending.
        this.logger.log(`Hourly updates ready for user=${u.userId}, Telegram delivery disabled, skipping sendUserUpdates`);
        await this.userSettingsService.markHourlyDelivered(u.userId, to);
      }
    }

    return;
  }

  @Cron('0 0 * * *')
  async dailyTrigger() {
    const to = new Date();
    to.setUTCHours(0, 0, 0, 0);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const dailyUsers = await (this as any).userSettingsService['model']
      .find({ updatesFrequency: 'daily' })
      .lean();
    for (const u of dailyUsers) {
      const events = await this.userUpdatesService.getUserUpdateEvents(u.userId, from, to);
      if (events.length > 0) {
        // Telegram notifications are disabled in this project; skip sending.
        this.logger.log(`Daily updates ready for user=${u.userId}, Telegram delivery disabled, skipping sendUserUpdates`);
        await this.userSettingsService.markDailyDelivered(u.userId, to);
      }
    }
  }

  async setFrequency(actorUri: string, updateFrequencyMs: number) {
    this.logger.log(`Setting frequency for actorUri: ${actorUri}, updateFrequencyMs: ${updateFrequencyMs}`);
    
    const nextUpdateAfter = new Date(
      Date.now() + parseInt(String(updateFrequencyMs ?? 1000 * 60)),
    );
    
    try {
      const result = await this.model.updateMany(
        { actorUri },
        { updateFrequencyMs, nextUpdateAfter },
        { upsert: true },
      );
      
      this.logger.log(`Update result:`, result);
      return { success: true, message: 'Frequency updated successfully' };
    } catch (error) {
      this.logger.error(`Failed to update frequency:`, error);
      throw error;
    }
  }
  async getFrequency(actorUri: string) {
    this.logger.log(`Getting frequency for actorUri: ${actorUri}`);
    
    const fr = await this.model.findOne({ actorUri }).select('updateFrequencyMs').lean();
    
    if (!fr) {
      this.logger.warn('freq not found for ', actorUri);
      return null;
    }
    
    this.logger.log(`Found frequency: ${fr.updateFrequencyMs} for actorUri: ${actorUri}`);
    return fr.updateFrequencyMs;
  }
}
