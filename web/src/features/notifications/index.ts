export {
  NOTIFICATION_CLIENT_LEGACY_MATRIX,
  NOTIFICATION_ROUTING_BY_TYPE,
  NOTIFICATION_ROUTING_MATRIX,
  NOTIFICATION_ROUTING_ROWS,
  assertNotificationRoutingParity,
  type NotificationLinkPattern,
} from './routing-matrix';
export { assertNotificationRoutingExhaustive, getNotificationRoutingRow } from './get-notification-routing-row';
export { resolveNotificationLink } from './resolve-notification-link';
export {
  renderNotificationSubtitle,
  type NotificationSubtitleContext,
} from './render-notification-subtitle';
