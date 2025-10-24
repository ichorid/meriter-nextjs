import { Controller, Get, Param } from '@nestjs/common';
import { successResponse } from '../utils/response.helper';
class RestRateResponse {
  rate: number;
}
@Controller('api/rest/rate')
export class RestRateController {
  @Get()
  rest_rate(@Param() fromCurrency: number) {
    return successResponse(0);
  }
}
