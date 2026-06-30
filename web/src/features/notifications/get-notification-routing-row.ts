import type { NotificationType as ApiNotificationType } from '@/types/api-v1';
import type {
  NotificationRoutingRow,
  NotificationType,
} from '@meriter/shared-types/schemas/notifications';
import {
  NOTIFICATION_ROUTING_BY_TYPE,
  NOTIFICATION_ROUTING_MATRIX,
} from './routing-matrix';

/** Legacy api-v1-only type outside the 47-type NotificationRoutingSchema. */
const LEGACY_INVITE_ROUTING_ROW: NotificationRoutingRow = {
  type: 'team_invitation',
  subtitleKey: 'message.default',
  linkPattern: 'project.orCommunity.inviteTarget',
};

type CanonicalNotificationType = Exclude<ApiNotificationType, 'invite'>;

function isCanonicalNotificationType(type: ApiNotificationType): type is CanonicalNotificationType {
  return type !== 'invite';
}

/** Resolves the inv-25 routing row for a notification type (47 exhaustive rows). */
export function getNotificationRoutingRow(type: ApiNotificationType): NotificationRoutingRow {
  if (type === 'invite') {
    return LEGACY_INVITE_ROUTING_ROW;
  }
  if (!isCanonicalNotificationType(type)) {
    throw new Error(`Notification routing matrix missing row for type "${type}"`);
  }
  const row = NOTIFICATION_ROUTING_BY_TYPE[type as NotificationType];
  if (!row) {
    throw new Error(`Notification routing matrix missing row for type "${type}"`);
  }
  return row;
}

/** Runtime guard: matrix covers every parsed routing row type. */
export function assertNotificationRoutingExhaustive(): void {
  if (NOTIFICATION_ROUTING_MATRIX.length !== 47) {
    throw new Error(
      `Expected 47 notification routing rows, got ${NOTIFICATION_ROUTING_MATRIX.length}`,
    );
  }
}
