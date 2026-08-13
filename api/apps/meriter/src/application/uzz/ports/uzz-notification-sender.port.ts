export interface UzzNotificationPayload {
  telegramUserId: string;
  text: string;
}

export interface UzzNotificationSender {
  send(eventId: string, payload: UzzNotificationPayload): Promise<void>;
}
