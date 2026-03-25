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
    futureVisions: "/meriter/future-visions",
    projects: "/meriter/projects",
    project: (id: string) => `/meriter/projects/${id}`,
    /** Project team list (wraps member management in project URL space). */
    projectMembers: (projectId: string) => `/meriter/projects/${projectId}/members`,
    /** Birzha posts published on behalf of this project (lead). */
    projectBirzhaPosts: (id: string) => `/meriter/projects/${id}/birzha-posts`,
    userProfile: (userId: string) => `/meriter/users/${userId}`,
    settings: "/meriter/settings",
    notifications: "/meriter/notifications",
    about: "/meriter/about",

    // Communities
    communities: "/meriter/communities",
    community: (id: string) => `/meriter/communities/${id}`,
    communityMembers: (id: string) => `/meriter/communities/${id}/members`,
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
    /** Invite accept flow; append ?t=<jwt> */
    communityJoin: (id: string) => `/meriter/communities/${id}/join`,
    communityProjects: (id: string) => `/meriter/communities/${id}/projects`,
    communityDeleted: (id: string) => `/meriter/communities/${id}/deleted`,
    /** Birzha posts published on behalf of this community (lead/admin). */
    communityBirzhaPosts: (id: string) => `/meriter/communities/${id}/birzha-posts`,
    communitySettings: (id: string) => `/meriter/communities/${id}/settings`,
    /** Opens General tab with future vision textarea focused (lead/superadmin settings). */
    communitySettingsEditFutureVision: (id: string) =>
        `/meriter/communities/${id}/settings?edit=futureVision`,
    setupCommunity: "/meriter/setup-community",
    /** Community post detail (publication id as slug). */
    communityPost: (communityId: string, postId: string) =>
      `/meriter/communities/${communityId}/posts/${postId}`,

    // Publications
    publication: (id: string) => `/meriter/publications/${id}`,

    // Polls
    polls: "/meriter/polls",
    poll: (id: string) => `/meriter/polls/${id}`,

    // Wallet
    wallet: "/meriter/wallet",
    transactions: "/meriter/wallet/transactions",
} as const;
