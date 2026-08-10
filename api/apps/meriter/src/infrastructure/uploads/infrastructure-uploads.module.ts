import { Module } from '@nestjs/common';

import { MEDIA_UPLOAD_PORT } from '../../domain/ports/media-upload.port';
import { UploadsService } from './media-upload.service';

@Module({
  providers: [
    UploadsService,
    { provide: MEDIA_UPLOAD_PORT, useExisting: UploadsService },
  ],
  exports: [UploadsService, MEDIA_UPLOAD_PORT],
})
export class InfrastructureUploadsModule {}
