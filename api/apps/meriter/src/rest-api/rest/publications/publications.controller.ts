import { Controller, Get, Param } from '@nestjs/common';
import { RestPublicationsinfResponse } from '../publicationsinf/publicationsinf.controller';

@Controller('api/rest/publications')
export class RestPublicationsController {
  @Get()
  rest_publications(@Param() my: string) {
    return new RestPublicationsinfResponse();
  }
}
