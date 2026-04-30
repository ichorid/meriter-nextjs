import { Module } from '@nestjs/common';
import { PilotController } from './pilot.controller';

@Module({
  controllers: [PilotController],
})
export class PilotModule {}

