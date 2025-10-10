import { Controller, Get } from '@nestjs/common';
import { MeriterService } from './meriter.service';

@Controller()
export class MeriterController {
  constructor(private readonly meriterService: MeriterService) {}

  @Get()
  getHello(): string {
    return this.meriterService.getHello();
  }
}
