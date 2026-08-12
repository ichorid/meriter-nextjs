import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UzzPurchaseGate = 'nudge' | 'require_min_lots';
export type UzzBankTransferMode =
  | 'escrow_until_close'
  | 'on_accept_locked'
  | 'on_close_only';

export interface UzzNotifyFlags {
  bankEmitted: boolean;
  dealRequested: boolean;
  dealAccepted: boolean;
  dealClosed: boolean;
  demurrageDaily: boolean;
  linkReminder: boolean;
}

export interface UzzSettings {
  communityId: string;
  emissionThreshold: number;
  bankInitialHops: number;
  demurrageRubPerDay: number;
  nominalFloorRub: number;
  minLotsToBuy: number;
  purchaseGate: UzzPurchaseGate;
  bankTransferMode: UzzBankTransferMode;
  dealRequestTtlHours: number;
  dealFulfillmentDays: number;
  notifyFlags: UzzNotifyFlags;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_NOTIFY_FLAGS: UzzNotifyFlags = {
  bankEmitted: true,
  dealRequested: true,
  dealAccepted: true,
  dealClosed: true,
  demurrageDaily: false,
  linkReminder: true,
};

@Schema({ collection: 'uzz_settings', timestamps: true })
export class UzzSettingsSchemaClass
  implements Omit<UzzSettings, 'createdAt' | 'updatedAt'>
{
  @Prop({ required: true, unique: true, index: true })
  communityId!: string;

  @Prop({ required: true, default: 10 })
  emissionThreshold!: number;

  @Prop({ required: true, default: 10 })
  bankInitialHops!: number;

  @Prop({ required: true, default: 100 })
  demurrageRubPerDay!: number;

  @Prop({ required: true, default: 100 })
  nominalFloorRub!: number;

  @Prop({ required: true, default: 3 })
  minLotsToBuy!: number;

  @Prop({ required: true, enum: ['nudge', 'require_min_lots'], default: 'nudge' })
  purchaseGate!: UzzPurchaseGate;

  @Prop({
    required: true,
    enum: ['escrow_until_close', 'on_accept_locked', 'on_close_only'],
    default: 'escrow_until_close',
  })
  bankTransferMode!: UzzBankTransferMode;

  @Prop({ required: true, default: 48 })
  dealRequestTtlHours!: number;

  @Prop({ required: true, default: 7 })
  dealFulfillmentDays!: number;

  @Prop({ type: Object, default: () => ({ ...DEFAULT_NOTIFY_FLAGS }) })
  notifyFlags!: UzzNotifyFlags;
}

export const UzzSettingsSchema = SchemaFactory.createForClass(UzzSettingsSchemaClass);
export type UzzSettingsDocument = UzzSettingsSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };

export const UZZ_SETTINGS_DEFAULTS = {
  emissionThreshold: 10,
  bankInitialHops: 10,
  demurrageRubPerDay: 100,
  nominalFloorRub: 100,
  minLotsToBuy: 3,
  purchaseGate: 'nudge' as UzzPurchaseGate,
  bankTransferMode: 'escrow_until_close' as UzzBankTransferMode,
  dealRequestTtlHours: 48,
  dealFulfillmentDays: 7,
  notifyFlags: DEFAULT_NOTIFY_FLAGS,
};
