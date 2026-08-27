export interface UzzNotificationPayload {
  /** Telegram chat id: a user's DM chat or a community group chat. */
  telegramChatId: string;
  text: string;
  path?: string;
}

export interface UzzNotificationSender {
  send(eventId: string, payload: UzzNotificationPayload): Promise<void>;
}
