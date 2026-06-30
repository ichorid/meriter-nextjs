import type { NotificationRecord } from '../../../domain/ports/notification.persistence.port';

/** Lean Mongoose notification document shape (plain fields). */
export type NotificationDocumentShape = NotificationRecord;

export function mapNotificationDocumentToRecord(
  doc: NotificationDocumentShape,
): NotificationRecord {
  return { ...doc, metadata: { ...doc.metadata } };
}

export function mapNotificationRecordToDocument(
  record: NotificationRecord,
): NotificationDocumentShape {
  return { ...record, metadata: { ...record.metadata } };
}
