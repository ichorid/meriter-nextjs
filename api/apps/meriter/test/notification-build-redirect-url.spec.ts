import { NotificationService } from '../src/domain/services/notification.service';
import type { Notification } from '../src/domain/models/notification/notification.schema';

function makeService(): NotificationService {
  return new NotificationService({} as never);
}

function n(partial: Pick<Notification, 'type' | 'metadata'>): Notification {
  return {
    id: 'n1',
    userId: 'u1',
    source: 'system',
    read: false,
    title: '',
    message: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Notification;
}

describe('NotificationService.buildRedirectUrl', () => {
  const service = makeService();

  it('ticket_* uses project page with highlight id', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'ticket_assigned',
          metadata: { projectId: 'proj-1', ticketId: 'tick-9' },
        }),
      ),
    ).toBe('/meriter/projects/proj-1?highlight=tick-9');
  });

  it('project_published uses birzha community and publication id', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'project_published',
          metadata: {
            birzhaCommunityId: 'birzha-1',
            publicationId: 'pub-2',
          },
        }),
      ),
    ).toBe('/meriter/communities/birzha-1?post=pub-2');
  });

  it('project_distributed uses project page', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'project_distributed',
          metadata: { projectId: 'p-3' },
        }),
      ),
    ).toBe('/meriter/projects/p-3');
  });

  it('ob_vote_join_offer uses publication community and post', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'ob_vote_join_offer',
          metadata: {
            publicationCommunityId: 'fv-1',
            publicationId: 'pub-ob',
          },
        }),
      ),
    ).toBe('/meriter/communities/fv-1?post=pub-ob');
  });

  it('ob_vote_join_offer falls back to futureVisionCommunityId', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'ob_vote_join_offer',
          metadata: {
            futureVisionCommunityId: 'fv-2',
            publicationId: 'pub-x',
          },
        }),
      ),
    ).toBe('/meriter/communities/fv-2?post=pub-x');
  });

  it('team_join_request uses members path when only communityId', () => {
    expect(
      service.buildRedirectUrl(
        n({
          type: 'team_join_request',
          metadata: { communityId: 'team-1' },
        }),
      ),
    ).toBe('/meriter/communities/team-1/members');
  });
});
