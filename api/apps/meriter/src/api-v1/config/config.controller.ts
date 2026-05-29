import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import {
  createGetRuntimeConfigUseCase,
  type PublicRuntimeConfig,
} from '../../application/use-cases/config/get-runtime-config.use-case';
import {
  PERMISSION_GATES_PORT,
  type PermissionGatesPort,
} from '../../domain/ports/permission-gates.port';

@Controller('api/v1/config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(PERMISSION_GATES_PORT)
    private readonly permissionGates: PermissionGatesPort,
  ) {}

  /**
   * Public runtime config for the SPA bootstrap.
   * Intentionally unauthenticated.
   */
  @Get()
  getConfig(): { success: true; data: PublicRuntimeConfig } {
    const data = createGetRuntimeConfigUseCase({
      configService: this.configService,
      permissionGates: this.permissionGates,
    }).execute();

    return ApiResponseHelper.successResponse(data);
  }
}
