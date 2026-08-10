import type { MeritTransferRecord } from './create-merit-transfer.port';

export const MERIT_TRANSFER_GROUP_NOTIFY_PORT = Symbol('MERIT_TRANSFER_GROUP_NOTIFY_PORT');

/** Optional: announce peer merit transfers in a linked Telegram group chat. */
export interface MeritTransferGroupNotifyPort {
  announceTransfer(record: MeritTransferRecord): Promise<void>;
}
