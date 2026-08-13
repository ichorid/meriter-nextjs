import { createHash, randomBytes } from 'crypto';
import { UzzTokenHasherPort } from '../../../application/uzz/ports/uzz-identity.port';

export class UzzTokenHasher implements UzzTokenHasherPort {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(16).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
