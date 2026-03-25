/**
 * Maps exact English API / tRPC error messages to next-intl keys under `apiErrors`.
 * Unknown messages fall back to `apiErrors.genericUnhandled` (locale from intl portal store).
 */
import { useIntlPortalStore } from '@/stores/intl-portal.store';

/** English message -> key in messages.*.json `apiErrors` */
export const KNOWN_API_ERROR_KEYS: Record<string, string> = {
  'You have already applied for this ticket': 'alreadyAppliedForTicket',
  'Publication is not a ticket': 'publicationIsNotATicket',
  'Ticket is not an open neutral ticket': 'ticketNotOpenNeutral',
  'User is not an applicant for this ticket': 'userNotApplicantForTicket',
  'Beneficiary must be a project member': 'beneficiaryMustBeProjectMember',
  'Only the project lead can create tickets': 'onlyLeadCanCreateTickets',
  'Only the project lead can create neutral tickets': 'onlyLeadCanCreateNeutralTickets',
  'Only the project lead can approve applicants': 'onlyLeadCanApproveApplicants',
  'Only the project lead can reject applicants': 'onlyLeadCanRejectApplicants',
  'Only the project lead can view applicants': 'onlyLeadCanViewApplicants',
  'Only the ticket beneficiary can mark it as done': 'onlyBeneficiaryCanMarkDone',
  'Only the current assignee can decline this task': 'onlyAssigneeCanDecline',
  'Only project members can view tickets': 'onlyMembersCanViewTickets',
  'Comment is required': 'commentRequired',
  'Comment is too long': 'commentTooLong',
  'Cannot reopen a ticket without an assignee': 'cannotReopenWithoutAssignee',
  'Task body cannot be empty': 'taskBodyCannotBeEmpty',
  'No updates provided': 'noUpdatesProvided',
  'Ticket must belong to a project community': 'ticketMustBelongToProject',
  'Assignee must be a project member': 'assigneeMustBeProjectMember',
  'Ticket must be in done status to accept work': 'ticketMustBeDoneToAccept',
  'Only a task in progress can be declined by the assignee': 'onlyInProgressCanDecline',
  'Not authenticated': 'notAuthenticated',
  'Authentication failed': 'authenticationFailed',
  'At least one field is required': 'atLeastOneFieldRequired',
  'Insufficient balance': 'insufficientBalance',
  'Insufficient merits': 'insufficientMerits',
  'Only the project lead can publish to Birzha': 'onlyLeadCanPublishToBirzha',
  'Project not found': 'projectNotFound',
  'Only project members can view the wallet': 'onlyMembersCanViewWallet',
  'Birzha community not found': 'birzhaNotFound',
  'Only project lead can update the project': 'onlyProjectLeadCanUpdate',
  'Only project members can view shares': 'onlyMembersCanViewShares',
  'Only the project lead can close the project': 'onlyLeadCanCloseProject',
  'Only the project lead can update shares': 'onlyLeadCanUpdateShares',
  'Only the current project lead can transfer admin': 'onlyCurrentLeadCanTransferAdmin',
  'Only project members can top up the wallet': 'onlyMembersCanTopUpWallet',
  'You are not a member of this project': 'notProjectMember',
  'Lead cannot leave; assign another lead first or close the project': 'leadCannotLeave',
  'Founder share must be between 0 and 100': 'founderShareRange',
  'Founder share can only be decreased': 'founderShareOnlyDecrease',
  'New lead must be a project member': 'newLeadMustBeMember',
  'New lead must be different from current lead': 'newLeadMustDiffer',
  'Amount must be a positive integer': 'amountPositiveInteger',
  'Parent community not found': 'parentCommunityNotFound',
  'parentCommunityId or newCommunity is required': 'parentOrNewCommunityRequired',
  'parentCommunityId, newCommunity, or personalProject is required': 'parentOrNewCommunityOrPersonalRequired',
  'Specify exactly one of: parentCommunityId, newCommunity, or personalProject true':
    'projectCreateExactlyOneMode',
  'personalProject cannot be combined with parentCommunityId or newCommunity':
    'personalProjectConflictWithParent',
  'Team has no lead': 'teamHasNoLead',
  'Request is not pending': 'requestNotPending',
  'Invitation is not pending': 'invitationNotPending',
  'Only leads can invite to team': 'onlyLeadsCanInvite',
  'You must be a member of this community to send an invite': 'mustBeMemberToInvite',
  'This user already has a pending invitation to this community': 'pendingInviteExists',
  'Cannot invite yourself': 'cannotInviteSelf',
  'You can only accept invitations sent to you': 'onlyTargetCanAcceptInvite',
  'You can only reject invitations sent to you': 'onlyTargetCanRejectInvite',
  'Only leads can approve requests for their team': 'onlyLeadsApproveRequests',
  'Only leads can reject requests for their team': 'onlyLeadsRejectRequests',
  'Only leads can view requests for their team': 'onlyLeadsViewRequests',
  'Lead management is only available for local membership communities': 'leadMgmtLocalOnly',
  'Only community leads can promote members': 'onlyLeadsCanPromoteMembers',
  'Cannot promote yourself this way': 'cannotPromoteSelfToLead',
  'Only participants can be promoted to lead': 'onlyParticipantsPromotedToLead',
  'Only leads can step down': 'onlyLeadsCanStepDown',
  'Promote another member to lead before stepping down': 'promoteAnotherLeadBeforeStepDown',
  'Only superadmin can update roles': 'onlySuperadminCanUpdateRoles',
  'You are already a member of this team': 'youAlreadyMemberThisTeam',
  'User is already a member of this team': 'userAlreadyMemberThisTeam',
  'User is already a member of this community': 'userAlreadyMemberCommunity',
  'Investment amount must be greater than 0': 'investmentAmountPositive',
  'This post does not accept investments': 'postDoesNotAcceptInvestments',
  'Cannot invest in a deleted post': 'cannotInvestDeletedPost',
  'Cannot invest in your own post': 'cannotInvestOwnPost',
  'Vote amounts cannot be negative': 'voteAmountsNonNegative',
  'Neutral comment must include comment text': 'neutralCommentNeedsText',
  'Poll expiration must be in the future': 'pollExpirationFuture',
  'Cannot edit poll after votes have been cast': 'cannotEditPollAfterVotes',
  'Poll must have at least 2 options': 'pollMinTwoOptions',
  'Poll is not active': 'pollNotActive',
  'Poll has expired': 'pollExpired',
  'Invalid option ID': 'invalidPollOption',
  'Cast amount must be positive': 'castAmountPositive',
  'Cast amount must be positive (quota or wallet)': 'castAmountPositiveQuotaOrWallet',
  'Quota amount must be positive': 'quotaAmountPositive',
  'Only project members can create posts': 'onlyMembersCanCreatePosts',
  'Beneficiary must be a registered user': 'beneficiaryMustBeUser',
  'beneficiaries array cannot exceed 2 items': 'beneficiariesMax2',
  'methods array cannot exceed 3 items': 'methodsMax3',
  'helpNeeded array cannot exceed 3 items': 'helpNeededMax3',
  'Cannot change post type when editing a publication': 'cannotChangePostType',
  'Cannot change project status when editing a publication': 'cannotChangeProjectStatus',
  'stopLoss must be >= 0': 'stopLossNonNegative',
  'Publication is not deleted': 'publicationNotDeleted',
  'Author share must be positive': 'authorSharePositive',
  'Project has no lead/founder': 'projectNoLead',
  'Deposit amount must be positive': 'depositPositive',
  'Amount must be positive': 'amountPositive',
  'Debit amount must be positive': 'debitPositive',
  'Validation failed': 'validationFailed',
  'Authentication required': 'authenticationRequired',
  'Session expired. Please login again.': 'sessionExpired',
  'Server error. Please try again later.': 'serverError',
  'Network error. Please check your connection.': 'networkError',
  'Network error. Check your connection.': 'networkError',
  'An error occurred': 'genericError',
  'Failed to copy URL': 'failedToCopyUrl',
  'An unexpected error occurred': 'unexpectedClientError',
  'Server response format is invalid. Please check if the backend API is running and accessible.':
    'serverResponseInvalid',
  'Network error - please check your connection': 'networkErrorAlt',
};

/** Dot path into loaded messages, e.g. `shared.urlCopiedToBuffer`. */
export function messageFromBundle(path: string): string | undefined {
  const { messages } = useIntlPortalStore.getState();
  const parts = path.split('.');
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function toastUiText(key: string): string {
  const { messages } = useIntlPortalStore.getState();
  const toasts = (messages as { toasts?: Record<string, string> }).toasts;
  return toasts?.[key] ?? key;
}

export function resolveApiErrorToastMessage(message: string | undefined): string {
  const { messages } = useIntlPortalStore.getState();
  const apiErrors = (messages as { apiErrors?: Record<string, string> }).apiErrors;
  const generic =
    apiErrors?.genericUnhandled ?? apiErrors?.generic ?? 'Something went wrong.';
  if (!message?.trim()) {
    return apiErrors?.generic ?? generic;
  }
  const key = KNOWN_API_ERROR_KEYS[message];
  if (key && apiErrors?.[key]) {
    return apiErrors[key];
  }
  return generic;
}
