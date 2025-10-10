import { Controller, Get, Param } from '@nestjs/common';
class RestRateResponse {
  rate: number;
}
@Controller('api/rest/rate')
export class RestRateController {
  @Get()
  rest_rate(@Param() fromCurrency: number) {
    return { rate: 0 };
  }
}
