/**
 * Maps API `voteDisabledReason` strings (see permissions-helper.service) to shared message keys.
 * Keeps next-intl keys static for tooling.
 */
export function toastMessageForVoteDisabledReason(
    reason: string | undefined,
    tShared: (key: string) => string,
): string {
    if (!reason) {
        return tShared('voteDisabled.default');
    }
    switch (reason) {
        case 'voteDisabled.notLoggedIn':
            return tShared('voteDisabled.notLoggedIn');
        case 'voteDisabled.projectPost':
            return tShared('voteDisabled.projectPost');
        case 'voteDisabled.projectOwnDiscussion':
            return tShared('voteDisabled.projectOwnDiscussion');
        case 'voteDisabled.projectOwnTicket':
            return tShared('voteDisabled.projectOwnTicket');
        case 'voteDisabled.noCommunity':
            return tShared('voteDisabled.noCommunity');
        case 'voteDisabled.isBeneficiary':
            return tShared('voteDisabled.isBeneficiary');
        case 'voteDisabled.isAuthor':
            return tShared('voteDisabled.isAuthor');
        case 'voteDisabled.teamOwnPost':
            return tShared('voteDisabled.teamOwnPost');
        case 'voteDisabled.roleNotAllowed':
            return tShared('voteDisabled.roleNotAllowed');
        case 'voteDisabled.ownPostNotAllowed':
            return tShared('voteDisabled.ownPostNotAllowed');
        case 'voteDisabled.viewerNotMarathon':
            return tShared('voteDisabled.viewerNotMarathon');
        case 'voteDisabled.teammateInSpecialGroup':
            return tShared('voteDisabled.teammateInSpecialGroup');
        case 'voteDisabled.commentVotingDisabled':
            return tShared('voteDisabled.commentVotingDisabled');
        case 'voteDisabled.neutralOnlyError':
            return tShared('voteDisabled.neutralOnlyError');
        default:
            return tShared('voteDisabled.default');
    }
}
