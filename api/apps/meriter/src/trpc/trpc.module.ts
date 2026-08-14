import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DomainModule } from '../domain.module';
import { ApiV1CommonModule } from '../api-v1/common/common.module';
import { AuthModule } from '../api-v1/auth/auth.module';
import { QuotaResetModule } from '../domain/services/quota-reset.module';
import { UploadsModule } from '../api-v1/uploads/uploads.module';
import { CommonServicesModule } from '../common/services/common-services.module';
import { ApplicationModule } from '../application/application.module';
import { YougileModule } from '../infrastructure/yougile/yougile.module';
import { RedeemUzzMagicLinkUseCase } from '../application/uzz/use-cases/redeem-uzz-magic-link.use-case';
import { AuthMagicLinkService } from '../infrastructure/auth/magic-link-auth.service';
import { AuthProviderService } from '../api-v1/auth/auth.service';
import { UserService } from '../domain/services/user.service';
import { UZZ_UNIT_OF_WORK, UzzUnitOfWork } from '../application/uzz/ports/uzz-unit-of-work';
import { UzzTokenHasher } from '../infrastructure/uzz/security/uzz-token-hasher';
import { UZZ_RATE_LIMITER_PORT, UzzRateLimiterPort } from '../application/uzz/ports/uzz-identity.port';

@Module({
  imports: [
    DomainModule,
    ApplicationModule,
    ApiV1CommonModule,
    AuthModule,
    QuotaResetModule,
    UploadsModule,
    CommonServicesModule, // Provides JwtVerificationService
    YougileModule, // YouGile integration ports for yougile.router
  ],
  // TrpcController removed - tRPC is handled via Express middleware in main.ts
  // to properly support batch requests with comma-separated paths
  providers: [
    {
      provide: RedeemUzzMagicLinkUseCase,
      inject: [
        AuthMagicLinkService,
        AuthProviderService,
        UserService,
        UZZ_UNIT_OF_WORK,
        UzzTokenHasher,
        UZZ_RATE_LIMITER_PORT,
      ],
      useFactory: (
        magicLinks: AuthMagicLinkService,
        auth: AuthProviderService,
        users: UserService,
        unitOfWork: UzzUnitOfWork,
        tokenHasher: UzzTokenHasher,
        rateLimiter: UzzRateLimiterPort,
      ) =>
        new RedeemUzzMagicLinkUseCase(
          magicLinks,
          {
            authenticateEmail: (email) => auth.authenticateEmail(email),
            findUserByEmail: (email) => users.getUserByAuthId('email', email),
            linkEmailIdentity: (userId, email) =>
              users.linkIdentity(userId, 'email', email),
            findUserById: (userId) => users.getUserById(userId),
          },
          unitOfWork,
          tokenHasher,
          rateLimiter,
        ),
    },
    TrpcService,
  ],
  exports: [TrpcService],
})
export class TrpcModule {}
