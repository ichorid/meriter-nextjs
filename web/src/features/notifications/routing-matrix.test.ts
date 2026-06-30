import {
  NOTIFICATION_ROUTING_MATRIX,
  NOTIFICATION_ROUTING_ROWS,
  assertNotificationRoutingParity,
} from './routing-matrix';
import { NotificationRoutingSchema } from '@meriter/shared-types/schemas/notifications';

/** Track B — inv-25 Phase 1 web parity gate vs NotificationsClient subtitle/link matrix. */
describe('notification routing matrix (Track B)', () => {
  it('exports 47 routing rows validated by NotificationRoutingSchema', () => {
    expect(NOTIFICATION_ROUTING_ROWS).toHaveLength(47);
    expect(() => NotificationRoutingSchema.parse(NOTIFICATION_ROUTING_ROWS)).not.toThrow();
    expect(NOTIFICATION_ROUTING_MATRIX).toHaveLength(47);
  });

  it('matches NotificationsClient legacy subtitle/link matrix', () => {
    expect(() => assertNotificationRoutingParity()).not.toThrow();
  });
});
