import {
    canActorManageCommunityLeads,
    canPromoteMemberToCommunityLead,
    isPlatformSuperadminUser,
} from './community-lead-actions';

describe('isPlatformSuperadminUser', () => {
    it('returns true for global superadmin', () => {
        expect(isPlatformSuperadminUser({ globalRole: 'superadmin' })).toBe(true);
    });

    it('returns false for regular users', () => {
        expect(isPlatformSuperadminUser({ globalRole: undefined })).toBe(false);
        expect(isPlatformSuperadminUser(null)).toBe(false);
    });
});

describe('canActorManageCommunityLeads', () => {
    it('allows platform superadmin on hub communities', () => {
        expect(
            canActorManageCommunityLeads({
                user: { globalRole: 'superadmin' },
                isCommunityAdmin: false,
                communityTypeTag: 'future-vision',
            }),
        ).toBe(true);
    });

    it('allows community lead on local communities', () => {
        expect(
            canActorManageCommunityLeads({
                user: {},
                isCommunityAdmin: true,
                communityTypeTag: 'team',
            }),
        ).toBe(true);
    });

    it('blocks community lead on hub communities', () => {
        expect(
            canActorManageCommunityLeads({
                user: {},
                isCommunityAdmin: true,
                communityTypeTag: 'future-vision',
            }),
        ).toBe(false);
    });
});

describe('canPromoteMemberToCommunityLead', () => {
    it('allows promoting a participant', () => {
        expect(canPromoteMemberToCommunityLead({ role: 'participant' })).toBe(true);
    });

    it('allows promoting platform superadmin listed as admin without participant role', () => {
        expect(
            canPromoteMemberToCommunityLead({
                role: undefined,
                globalRole: 'superadmin',
            }),
        ).toBe(true);
    });

    it('allows promoting legacy superadmin community role row', () => {
        expect(canPromoteMemberToCommunityLead({ role: 'superadmin' })).toBe(true);
    });

    it('rejects existing leads', () => {
        expect(canPromoteMemberToCommunityLead({ role: 'lead' })).toBe(false);
    });
});
