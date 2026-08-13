export interface UzzNotificationPayload {
  telegramUserId: string;
  text: string;
  path?: string;
}

export interface UzzNotificationSender {
  send(eventId: string, payload: UzzNotificationPayload): Promise<void>;
}
