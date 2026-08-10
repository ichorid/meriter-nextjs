import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { DocumentService } from '../../domain/services/document.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { UserService } from '../../domain/services/user.service';

@Injectable()
export class DocumentLiveAccessService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
  ) {}

  async assertCanSubscribe(userId: string, documentId: string): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }

    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return;
    }

    const role = await this.userCommunityRoleService.getRole(userId, doc.communityId);
    if (!role) {
      throw new ForbiddenException('You must be a community member to view this document');
    }
  }
}
