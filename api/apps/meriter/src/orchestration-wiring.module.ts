import { Global, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { DomainModule } from './domain.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import type { AppConfig } from './config/configuration';

import { CommunityService } from './domain/services/community.service';
import { WalletContextResolverService } from './domain/services/wallet-context-resolver.service';
import { NotificationService } from './domain/services/notification.service';
import { UserService } from './domain/services/user.service';
import { WalletService } from './domain/services/wallet.service';
import { UserCommunityRoleService } from './domain/services/user-community-role.service';
import { PlatformSettingsService } from './domain/services/platform-settings.service';
import { VoteService } from './domain/services/vote.service';
import { PermissionService } from './domain/services/permission.service';
import { CommunityWalletService } from './domain/services/community-wallet.service';
import { DocumentLiveUpdatesService } from './domain/services/document-live-updates.service';
import { DocumentService } from './domain/services/document.service';
import { DocumentVariantService } from './domain/services/document-variant.service';
import { EventBus } from './domain/events/event-bus';
import { EventService } from './domain/services/event.service';
import { ProjectPayoutService } from './domain/services/project-payout.service';
import {
  TeamJoinRequestService,
  loadPendingJoinRequestForLead,
} from './domain/services/team-join-request.service';
import { loadPendingInvitationForTarget } from './domain/services/team-invitation.service';

import { INVESTMENT_PERSISTENCE_PORT } from './domain/ports/investment.persistence.port';
import {
  DISTRIBUTE_ON_WITHDRAWAL_PORT,
  type DistributeOnWithdrawalPort,
} from './domain/ports/distribute-on-withdrawal.port';
import { HANDLE_POST_CLOSE_PORT } from './domain/ports/handle-post-close.port';
import { MERIT_TRANSFER_PERSISTENCE_PORT } from './domain/ports/merit-transfer.persistence.port';
import { PUBLICATION_PERSISTENCE_PORT } from './domain/ports/publication.persistence.port';
import { CREATE_MERIT_TRANSFER_PORT } from './domain/ports/create-merit-transfer.port';
import { USER_PERSISTENCE_PORT } from './domain/ports/user.persistence.port';
import { PROVISION_BASE_MEMBERSHIP_PORT } from './domain/ports/provision-base-membership.port';
import { TICKET_PERSISTENCE_PORT } from './domain/ports/ticket.persistence.port';
import { TRANSITION_TICKET_STATUS_PORT } from './domain/ports/transition-ticket-status.port';
import { CREATE_PUBLICATION_PORT } from './domain/ports/create-publication.port';
import {
  PUBLISH_PROJECT_TO_BIRZHA_PORT,
  PUBLISH_COMMUNITY_TO_BIRZHA_PORT,
} from './domain/ports/publish-to-birzha.port';
import { INVEST_IN_PROJECT_PORT } from './domain/ports/invest-in-project.port';
import { EXECUTE_PROJECT_PAYOUT_PORT } from './domain/ports/execute-project-payout.port';
import { DOCUMENT_PERSISTENCE_PORT } from './domain/ports/document.persistence.port';
import {
  FINALIZE_DOCUMENT_WAVE_PORT,
  type FinalizeDocumentWavePort,
} from './domain/ports/finalize-document-wave.port';
import { PROPOSE_DOCUMENT_VARIANT_PORT } from './domain/ports/propose-document-variant.port';
import { TEAM_JOIN_REQUEST_PERSISTENCE_PORT } from './domain/ports/team-join-request.persistence.port';
import { TEAM_INVITATION_PERSISTENCE_PORT } from './domain/ports/team-invitation.persistence.port';
import {
  SUBMIT_TEAM_JOIN_REQUEST_PORT,
  APPROVE_TEAM_JOIN_REQUEST_PORT,
  REJECT_TEAM_JOIN_REQUEST_PORT,
} from './domain/ports/team-join-request-flows.port';
import { ACCEPT_TEAM_INVITATION_PORT } from './domain/ports/accept-team-invitation.port';

import type { InvestmentPersistencePort } from './domain/ports/investment.persistence.port';
import type { MeritTransferPersistencePort } from './domain/ports/merit-transfer.persistence.port';
import type { PublicationPersistencePort } from './domain/ports/publication.persistence.port';
import type { UserPersistencePort } from './domain/ports/user.persistence.port';
import type { TicketPersistencePort } from './domain/ports/ticket.persistence.port';
import type { DocumentPersistencePort } from './domain/ports/document.persistence.port';
import type { TeamJoinRequestPersistencePort } from './domain/ports/team-join-request.persistence.port';
import type { TeamInvitationPersistencePort } from './domain/ports/team-invitation.persistence.port';
import { DistributeOnWithdrawalUseCase } from './application/use-cases/investments/distribute-on-withdrawal.use-case';
import { HandlePostCloseUseCase } from './application/use-cases/investments/handle-post-close.use-case';
import { createCreateMeritTransferUseCase } from './application/use-cases/merit-transfer/create-merit-transfer.use-case';
import { createProvisionBaseMembershipUseCase } from './application/use-cases/communities/provision-base-membership.use-case';
import { createTransitionTicketStatusUseCase } from './application/use-cases/tickets/transition-ticket-status.use-case';
import { createCreatePublicationUseCase } from './application/use-cases/publications/create-publication.use-case';
import { createPublishProjectToBirzhaUseCase } from './application/use-cases/projects/publish-project-to-birzha.use-case';
import { createPublishCommunityToBirzhaUseCase } from './application/use-cases/communities/publish-community-to-birzha.use-case';
import { createInvestInProjectUseCase } from './application/use-cases/projects/invest-in-project.use-case';
import { createExecuteProjectPayoutUseCase } from './application/use-cases/projects/execute-project-payout.use-case';
import { createFinalizeDocumentWaveUseCase } from './application/use-cases/documents/finalize-document-wave.use-case';
import { createProposeDocumentVariantUseCase } from './application/use-cases/documents/propose-document-variant.use-case';
import { createSubmitTeamJoinRequestUseCase } from './application/use-cases/teams/submit-team-join-request.use-case';
import { createApproveTeamJoinRequestUseCase } from './application/use-cases/teams/approve-team-join-request.use-case';
import { createRejectTeamJoinRequestUseCase } from './application/use-cases/teams/reject-team-join-request.use-case';
import { createAcceptTeamInvitationUseCase } from './application/use-cases/teams/accept-team-invitation.use-case';

/**
 * Composition root for domain->application orchestration inversion (Zone 8).
 *
 * Domain services depend on orchestration *port tokens* (in `domain/ports/`); the
 * concrete application use cases that implement those ports are constructed here and
 * bound to the tokens. This module is the only place that references both layers, so
 * neither `domain/**` nor `application/**` imports the other (no module cycle, no
 * Zone 8 file-level violation). `@Global` makes the tokens resolvable by services
 * declared in `DomainModule` without `DomainModule` importing this module back.
 */
@Global()
@Module({
  imports: [DomainModule, PersistenceModule],
  providers: [
    {
      provide: DISTRIBUTE_ON_WITHDRAWAL_PORT,
      useFactory: (
        investmentPersistence: InvestmentPersistencePort,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
        communityService: CommunityService,
        notificationService: NotificationService,
        userService: UserService,
      ) =>
        new DistributeOnWithdrawalUseCase({
          investmentPersistence,
          walletService,
          walletContextResolverService,
          communityService,
          notificationService,
          userService,
        }),
      inject: [
        INVESTMENT_PERSISTENCE_PORT,
        WalletService,
        WalletContextResolverService,
        CommunityService,
        NotificationService,
        UserService,
      ],
    },
    {
      provide: HANDLE_POST_CLOSE_PORT,
      useFactory: (
        investmentPersistence: InvestmentPersistencePort,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
        communityService: CommunityService,
        distributeOnWithdrawalUseCase: DistributeOnWithdrawalPort,
      ) =>
        new HandlePostCloseUseCase({
          investmentPersistence,
          walletService,
          walletContextResolverService,
          communityService,
          distributeOnWithdrawalUseCase,
        }),
      inject: [
        INVESTMENT_PERSISTENCE_PORT,
        WalletService,
        WalletContextResolverService,
        CommunityService,
        DISTRIBUTE_ON_WITHDRAWAL_PORT,
      ],
    },
    {
      provide: CREATE_MERIT_TRANSFER_PORT,
      useFactory: (
        meritTransferPersistence: MeritTransferPersistencePort,
        publicationPersistence: PublicationPersistencePort,
        walletService: WalletService,
        communityService: CommunityService,
        userCommunityRoleService: UserCommunityRoleService,
        walletContextResolverService: WalletContextResolverService,
      ) =>
        createCreateMeritTransferUseCase({
          meritTransferPersistence,
          publicationPersistence,
          walletService,
          communityService,
          userCommunityRoleService,
          walletContextResolverService,
        }),
      inject: [
        MERIT_TRANSFER_PERSISTENCE_PORT,
        PUBLICATION_PERSISTENCE_PORT,
        WalletService,
        CommunityService,
        UserCommunityRoleService,
        WalletContextResolverService,
      ],
    },
    {
      provide: PROVISION_BASE_MEMBERSHIP_PORT,
      useFactory: (
        userPersistence: UserPersistencePort,
        communityService: CommunityService,
        userCommunityRoleService: UserCommunityRoleService,
        walletService: WalletService,
        platformSettingsService: PlatformSettingsService,
        configService: ConfigService<AppConfig>,
      ) =>
        createProvisionBaseMembershipUseCase({
          userPersistence,
          communityService,
          userCommunityRoleService,
          walletService,
          platformSettingsService,
          productMode: configService.get('app')?.productMode ?? 'full',
        }),
      inject: [
        USER_PERSISTENCE_PORT,
        CommunityService,
        UserCommunityRoleService,
        WalletService,
        PlatformSettingsService,
        ConfigService,
      ],
    },
    {
      provide: TRANSITION_TICKET_STATUS_PORT,
      useFactory: (
        ticketPersistence: TicketPersistencePort,
        communityService: CommunityService,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        notificationService: NotificationService,
        voteService: VoteService,
      ) =>
        createTransitionTicketStatusUseCase({
          ticketPersistence,
          communityService,
          userCommunityRoleService,
          userService,
          notificationService,
          voteService,
        }),
      inject: [
        TICKET_PERSISTENCE_PORT,
        CommunityService,
        UserCommunityRoleService,
        UserService,
        NotificationService,
        VoteService,
      ],
    },
    {
      provide: CREATE_PUBLICATION_PORT,
      useFactory: (
        publicationPersistence: PublicationPersistencePort,
        connection: Connection,
        eventBus: EventBus,
        permissionService: PermissionService,
        communityService: CommunityService,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        communityWalletService: CommunityWalletService,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
      ) =>
        createCreatePublicationUseCase({
          publicationPersistence,
          connection,
          eventBus,
          permissionService,
          communityService,
          userCommunityRoleService,
          userService,
          communityWalletService,
          walletService,
          walletContextResolverService,
        }),
      inject: [
        PUBLICATION_PERSISTENCE_PORT,
        getConnectionToken(),
        EventBus,
        PermissionService,
        CommunityService,
        UserCommunityRoleService,
        UserService,
        CommunityWalletService,
        WalletService,
        WalletContextResolverService,
      ],
    },
    {
      provide: PUBLISH_PROJECT_TO_BIRZHA_PORT,
      useFactory: (
        publicationPersistence: PublicationPersistencePort,
        eventBus: EventBus,
        communityService: CommunityService,
        userService: UserService,
        communityWalletService: CommunityWalletService,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
      ) =>
        createPublishProjectToBirzhaUseCase({
          publicationPersistence,
          eventBus,
          communityService,
          userService,
          communityWalletService,
          walletService,
          walletContextResolverService,
        }),
      inject: [
        PUBLICATION_PERSISTENCE_PORT,
        EventBus,
        CommunityService,
        UserService,
        CommunityWalletService,
        WalletService,
        WalletContextResolverService,
      ],
    },
    {
      provide: PUBLISH_COMMUNITY_TO_BIRZHA_PORT,
      useFactory: (
        publicationPersistence: PublicationPersistencePort,
        eventBus: EventBus,
        communityService: CommunityService,
        userService: UserService,
        communityWalletService: CommunityWalletService,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
      ) =>
        createPublishCommunityToBirzhaUseCase({
          publicationPersistence,
          eventBus,
          communityService,
          userService,
          communityWalletService,
          walletService,
          walletContextResolverService,
        }),
      inject: [
        PUBLICATION_PERSISTENCE_PORT,
        EventBus,
        CommunityService,
        UserService,
        CommunityWalletService,
        WalletService,
        WalletContextResolverService,
      ],
    },
    {
      provide: INVEST_IN_PROJECT_PORT,
      useFactory: (
        communityService: CommunityService,
        communityWalletService: CommunityWalletService,
        walletService: WalletService,
        walletContextResolverService: WalletContextResolverService,
      ) =>
        createInvestInProjectUseCase({
          communityService,
          communityWalletService,
          walletService,
          walletContextResolverService,
        }),
      inject: [
        CommunityService,
        CommunityWalletService,
        WalletService,
        WalletContextResolverService,
      ],
    },
    {
      provide: EXECUTE_PROJECT_PAYOUT_PORT,
      useFactory: (
        projectPayoutService: ProjectPayoutService,
        userCommunityRoleService: UserCommunityRoleService,
      ) =>
        createExecuteProjectPayoutUseCase({
          projectPayoutService,
          userCommunityRoleService,
        }),
      inject: [ProjectPayoutService, UserCommunityRoleService],
    },
    {
      provide: FINALIZE_DOCUMENT_WAVE_PORT,
      useFactory: (
        documentService: DocumentService,
        documentPersistence: DocumentPersistencePort,
        communityService: CommunityService,
        notificationService: NotificationService,
        moduleRef: ModuleRef,
        documentLiveUpdates: DocumentLiveUpdatesService,
      ) =>
        createFinalizeDocumentWaveUseCase({
          documentService,
          documentPersistence,
          communityService,
          notificationService,
          // Lazy resolve to break the construction cycle: auto-apply re-enters
          // DocumentVariantService, which itself depends on this port.
          autoApplyWinner: (documentId, blockId) =>
            moduleRef
              .get(DocumentVariantService, { strict: false })
              .tryAutoApplyWinner(documentId, blockId),
          autoApplyThreadWinner: (documentId, variantId) =>
            moduleRef
              .get(DocumentVariantService, { strict: false })
              .tryAutoApplyThreadWinner(documentId, variantId),
          documentLiveUpdates,
        }),
      inject: [
        DocumentService,
        DOCUMENT_PERSISTENCE_PORT,
        CommunityService,
        NotificationService,
        ModuleRef,
        DocumentLiveUpdatesService,
      ],
    },
    {
      provide: PROPOSE_DOCUMENT_VARIANT_PORT,
      useFactory: (
        documentService: DocumentService,
        documentPersistence: DocumentPersistencePort,
        communityService: CommunityService,
        walletService: WalletService,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        notificationService: NotificationService,
        permissionService: PermissionService,
        connection: Connection,
        finalizeDocumentWave: FinalizeDocumentWavePort,
        documentLiveUpdates: DocumentLiveUpdatesService,
      ) =>
        createProposeDocumentVariantUseCase({
          documentService,
          documentPersistence,
          communityService,
          walletService,
          userCommunityRoleService,
          userService,
          notificationService,
          permissionService,
          connection,
          finalizeExpiredWaveOnBlock: (documentId, blockId) =>
            finalizeDocumentWave.finalizeBlock(documentId, blockId),
          documentLiveUpdates,
        }),
      inject: [
        DocumentService,
        DOCUMENT_PERSISTENCE_PORT,
        CommunityService,
        WalletService,
        UserCommunityRoleService,
        UserService,
        NotificationService,
        PermissionService,
        getConnectionToken(),
        FINALIZE_DOCUMENT_WAVE_PORT,
        DocumentLiveUpdatesService,
      ],
    },
    {
      provide: SUBMIT_TEAM_JOIN_REQUEST_PORT,
      useFactory: (
        teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
        communityService: CommunityService,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        notificationService: NotificationService,
      ) =>
        createSubmitTeamJoinRequestUseCase({
          teamJoinRequestPersistence,
          communityService,
          userCommunityRoleService,
          userService,
          notificationService,
        }),
      inject: [
        TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
        CommunityService,
        UserCommunityRoleService,
        UserService,
        NotificationService,
      ],
    },
    {
      provide: APPROVE_TEAM_JOIN_REQUEST_PORT,
      useFactory: (
        teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        communityService: CommunityService,
        notificationService: NotificationService,
        eventService: EventService,
      ) =>
        createApproveTeamJoinRequestUseCase({
          loadPendingJoinRequestForLead: (requestId, leadId, action) =>
            loadPendingJoinRequestForLead(
              teamJoinRequestPersistence,
              requestId,
              leadId,
              action,
              userCommunityRoleService,
              userService,
            ),
          userCommunityRoleService,
          userService,
          communityService,
          notificationService,
          eventService,
        }),
      inject: [
        TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
        UserCommunityRoleService,
        UserService,
        CommunityService,
        NotificationService,
        EventService,
      ],
    },
    {
      provide: REJECT_TEAM_JOIN_REQUEST_PORT,
      useFactory: (
        teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        communityService: CommunityService,
        notificationService: NotificationService,
      ) =>
        createRejectTeamJoinRequestUseCase({
          loadPendingJoinRequestForLead: (requestId, leadId, action) =>
            loadPendingJoinRequestForLead(
              teamJoinRequestPersistence,
              requestId,
              leadId,
              action,
              userCommunityRoleService,
              userService,
            ),
          userService,
          communityService,
          notificationService,
        }),
      inject: [
        TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
        UserCommunityRoleService,
        UserService,
        CommunityService,
        NotificationService,
      ],
    },
    {
      provide: ACCEPT_TEAM_INVITATION_PORT,
      useFactory: (
        teamInvitationPersistence: TeamInvitationPersistencePort,
        userCommunityRoleService: UserCommunityRoleService,
        userService: UserService,
        communityService: CommunityService,
        notificationService: NotificationService,
        teamJoinRequestService: TeamJoinRequestService,
      ) =>
        createAcceptTeamInvitationUseCase({
          loadPendingInvitationForTarget: (invitationId, targetUserId, action) =>
            loadPendingInvitationForTarget(
              teamInvitationPersistence,
              invitationId,
              targetUserId,
              action,
            ),
          userCommunityRoleService,
          userService,
          communityService,
          notificationService,
          teamJoinRequestService,
        }),
      inject: [
        TEAM_INVITATION_PERSISTENCE_PORT,
        UserCommunityRoleService,
        UserService,
        CommunityService,
        NotificationService,
        TeamJoinRequestService,
      ],
    },
  ],
  exports: [
    DISTRIBUTE_ON_WITHDRAWAL_PORT,
    HANDLE_POST_CLOSE_PORT,
    CREATE_MERIT_TRANSFER_PORT,
    PROVISION_BASE_MEMBERSHIP_PORT,
    TRANSITION_TICKET_STATUS_PORT,
    CREATE_PUBLICATION_PORT,
    PUBLISH_PROJECT_TO_BIRZHA_PORT,
    PUBLISH_COMMUNITY_TO_BIRZHA_PORT,
    INVEST_IN_PROJECT_PORT,
    EXECUTE_PROJECT_PAYOUT_PORT,
    FINALIZE_DOCUMENT_WAVE_PORT,
    PROPOSE_DOCUMENT_VARIANT_PORT,
    SUBMIT_TEAM_JOIN_REQUEST_PORT,
    APPROVE_TEAM_JOIN_REQUEST_PORT,
    REJECT_TEAM_JOIN_REQUEST_PORT,
    ACCEPT_TEAM_INVITATION_PORT,
  ],
})
export class OrchestrationWiringModule {}
