import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NotificationTypeSchema } from '@meriter/shared-types/schemas/notifications';
import {
  NOTIFICATION_ROUTING_BY_TYPE,
  NOTIFICATION_ROUTING_MATRIX,
} from './routing-matrix';
import { getNotificationRoutingRow } from './get-notification-routing-row';

/** inv-25 Phase 7 — UI routes all 47 types through NOTIFICATION_ROUTING_MATRIX. */
describe('notification routing inv-25 UI enforcer', () => {
  it('matrix indexes every NotificationTypeSchema literal', () => {
    expect(NOTIFICATION_ROUTING_MATRIX).toHaveLength(47);
    for (const type of NotificationTypeSchema.options) {
      expect(NOTIFICATION_ROUTING_BY_TYPE[type]).toBeDefined();
      expect(getNotificationRoutingRow(type).type).toBe(type);
    }
  });

  it('NotificationsClient delegates subtitle/link to features/notifications', () => {
    const clientPath = path.join(
      process.cwd(),
      'src/components/organisms/Notifications/NotificationsClient.tsx',
    );
    const source = readFileSync(clientPath, 'utf8');
    expect(source).toContain("from '@/features/notifications/resolve-notification-link'");
    expect(source).toContain("from '@/features/notifications/render-notification-subtitle'");
    expect(source).not.toMatch(/resolveNotificationLink\s*\([^)]*notification\.type/);
    expect(source).not.toContain('const renderNotificationSubtitle =');
  });
});
