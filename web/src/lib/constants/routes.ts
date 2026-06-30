/**
 * Application route constants
 */

export const routes = {
    // Auth
    login: "/meriter/login",
    logout: "/meriter/logout",

    // Main
    home: "/meriter/home", // Deprecated - use profile instead
    profile: "/meriter/profile",
    profileMeritTransfers: "/meriter/profile/merit-transfers",
    futureVisions: "/meriter/future-visions",
    projects: "/meriter/projects",
    project: (id: string) => `/meriter/projects/${id}`,
    /** Project team list (wraps member management in project URL space). */
    projectMembers: (projectId: string) => `/meriter/projects/${projectId}/members`,
    projectMeritTransfers: (projectId: string) => `/meriter/projects/${projectId}/merit-transfers`,
    projectMeritHistory: (projectId: string) => `/meriter/projects/${projectId}/merit-history`,
    projectEvents: (projectId: string) => `/meriter/projects/${projectId}/events`,
    /** Birzha posts published on behalf of this project (lead). */
    projectBirzhaPosts: (id: string) => `/meriter/projects/${id}/birzha-posts`,
    userProfile: (userId: string) => `/meriter/users/${userId}`,
    userProfilePublications: (userId: string) => `/meriter/users/${userId}/publications`,
    userProfileComments: (userId: string) => `/meriter/users/${userId}/comments`,
    userProfilePolls: (userId: string) => `/meriter/users/${userId}/polls`,
    userProfileMeritTransfers: (userId: string) => `/meriter/users/${userId}/merit-transfers`,
    /** Global-wallet merit ledger for a user; `context` = community id for permission (see wallets.getTransactions). */
    userMeritHistory: (userId: string, permissionCommunityId: string) =>
        `/meriter/users/${userId}/merit-history?context=${encodeURIComponent(permissionCommunityId)}`,
    settings: "/meriter/settings",
    notifications: "/meriter/notifications",
    about: "/meriter/about",

    // Communities
    communities: "/meriter/communities",
    community: (id: string) => `/meriter/communities/${id}`,
    communityMembers: (id: string) => `/meriter/communities/${id}/members`,
    /** Peer-to-peer merit transfers scoped to this community / project context. */
    communityMeritTransfers: (id: string) => `/meriter/communities/${id}/merit-transfers`,
    /** Aggregate merit ledger for members in this community context. */
    communityMeritHistory: (id: string) => `/meriter/communities/${id}/merit-history`,
    communityEvents: (id: string) => `/meriter/communities/${id}/events`,
    /** Collaborative documents (WYSIWYG hub). */
    communityDocuments: (id: string) => `/meriter/communities/${id}/documents`,
    communityDocument: (communityId: string, documentId: string) =>
        `/meriter/communities/${communityId}/documents/${documentId}`,
    /** Document canvas deep link to a block (notifications, share). */
    communityDocumentBlock: (
        communityId: string,
        documentId: string,
        blockId: string,
    ) => `/meriter/communities/${communityId}/documents/${documentId}#block-${blockId}`,
    /** @deprecated Use projectMembers — canonical URL is under /meriter/projects/:id/members */
    projectMembersManage: (projectCommunityId: string) =>
      `/meriter/projects/${projectCommunityId}/members`,
    /** Create discussion in project community; after publish, return to project discussions tab. */
    projectDiscussionCreate: (projectCommunityId: string) => {
      const q = new URLSearchParams({
        postType: 'discussion',
        returnTo: `/meriter/projects/${projectCommunityId}?tab=discussions`,
      });
      return `/meriter/communities/${projectCommunityId}/create?${q.toString()}`;
    },
    /** Invite landing without token (join request fallback). */
    communityJoin: (id: string) => `/meriter/communities/${id}/join`,
    /** Short DB-backed community invite link (canonical). */
    communityInviteLink: (token: string) => `/meriter/join/${encodeURIComponent(token)}`,
    /** Legacy JWT invite with community id in the path (backward compatibility). */
    communityInviteLegacyLink: (id: string, token: string) =>
        `/meriter/communities/${id}/join/${encodeURIComponent(token)}`,
    communityProjects: (id: string) => `/meriter/communities/${id}/projects`,
    communityDeleted: (id: string) => `/meriter/communities/${id}/deleted`,
    /** Birzha posts published on behalf of this community (lead/admin). */
    communityBirzhaPosts: (id: string) => `/meriter/communities/${id}/birzha-posts`,
    /** Create a Birzha publication on behalf of this source community (lead). */
    communityBirzhaPublish: (id: string) => `/meriter/communities/${id}/birzha-publish`,
    communitySettings: (id: string) => `/meriter/communities/${id}/settings`,
    /** Legacy: settings used to focus OB textarea; now redirects to collaborative documents hub. */
    communitySettingsEditFutureVision: (id: string) =>
        `/meriter/communities/${id}/settings?edit=futureVision`,
    setupCommunity: "/meriter/setup-community",
    /** Community post detail (publication id as slug). */
    communityPost: (communityId: string, postId: string) =>
      `/meriter/communities/${communityId}/posts/${postId}`,
    /** Event publication (same id space as community / project workspace). */
    eventView: (communityId: string, publicationId: string) =>
      `/meriter/event/${communityId}/${publicationId}`,
    /** RSVP via invite token (public landing, auth required to confirm). */
    eventInvite: (token: string) => `/meriter/event/invite/${token}`,

    // Publications
    publication: (id: string) => `/meriter/publications/${id}`,

    // Polls
    polls: "/meriter/polls",
    poll: (id: string) => `/meriter/polls/${id}`,

    // Wallet
    wallet: "/meriter/wallet",
    transactions: "/meriter/wallet/transactions",
} as const;
