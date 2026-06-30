import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [ConfigController],
})
export class ConfigModule {}
