import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [NotificationsController],
  // NotificationService and NotificationHandlersService are already exported from DomainModule
})
export class NotificationsModule {}

