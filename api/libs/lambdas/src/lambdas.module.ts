import { Module } from '@nestjs/common';
import { LambdasService } from './lambdas.service';

@Module({
  providers: [LambdasService],
  exports: [LambdasService],
})
export class LambdasModule {}
