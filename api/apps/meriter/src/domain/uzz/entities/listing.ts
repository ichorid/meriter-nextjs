import { UzzValidationError } from '../errors';
import { Rubles } from '../value-objects/rubles';

export type ListingDeliveryMode = 'online' | 'offline' | 'both';

export interface CreateListingInput {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  description: string;
  priceRub: number;
  deliveryMode: ListingDeliveryMode;
  locationText: string;
  durationText: string;
  availabilityText: string;
  now: Date;
}

export interface ListingSnapshot extends Omit<CreateListingInput, 'now'> {
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Listing {
  private constructor(private state: ListingSnapshot) {}

  static create(input: CreateListingInput): Listing {
    const now = new Date(input.now);
    return Listing.restore({
      id: requireText(input.id, 1, 200, 'LISTING_ID_INVALID'),
      communityId: requireText(
        input.communityId,
        1,
        200,
        'LISTING_COMMUNITY_ID_INVALID',
      ),
      authorId: requireText(
        input.authorId,
        1,
        200,
        'LISTING_AUTHOR_ID_INVALID',
      ),
      title: requireText(input.title, 3, 120, 'LISTING_TITLE_INVALID'),
      description: optionalText(
        input.description,
        2000,
        'LISTING_DESCRIPTION_INVALID',
      ),
      priceRub: Rubles.create(input.priceRub).value,
      deliveryMode: input.deliveryMode,
      locationText: optionalText(
        input.locationText,
        160,
        'LISTING_LOCATION_INVALID',
      ),
      durationText: optionalText(
        input.durationText,
        120,
        'LISTING_DURATION_INVALID',
      ),
      availabilityText: optionalText(
        input.availabilityText,
        500,
        'LISTING_AVAILABILITY_INVALID',
      ),
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static restore(snapshot: ListingSnapshot): Listing {
    if (!['online', 'offline', 'both'].includes(snapshot.deliveryMode)) {
      throw new UzzValidationError('LISTING_DELIVERY_MODE_INVALID');
    }
    const normalized: ListingSnapshot = {
      ...snapshot,
      id: requireText(snapshot.id, 1, 200, 'LISTING_ID_INVALID'),
      communityId: requireText(
        snapshot.communityId,
        1,
        200,
        'LISTING_COMMUNITY_ID_INVALID',
      ),
      authorId: requireText(
        snapshot.authorId,
        1,
        200,
        'LISTING_AUTHOR_ID_INVALID',
      ),
      title: requireText(snapshot.title, 3, 120, 'LISTING_TITLE_INVALID'),
      description: optionalText(
        snapshot.description,
        2000,
        'LISTING_DESCRIPTION_INVALID',
      ),
      priceRub: Rubles.create(snapshot.priceRub).value,
      locationText: optionalText(
        snapshot.locationText,
        160,
        'LISTING_LOCATION_INVALID',
      ),
      durationText: optionalText(
        snapshot.durationText,
        120,
        'LISTING_DURATION_INVALID',
      ),
      availabilityText: optionalText(
        snapshot.availabilityText,
        500,
        'LISTING_AVAILABILITY_INVALID',
      ),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    };
    if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 0) {
      throw new UzzValidationError('LISTING_VERSION_INVALID');
    }
    return new Listing(normalized);
  }

  deactivate(now: Date): void {
    this.state.active = false;
    this.state.updatedAt = new Date(now);
  }

  update(
    patch: Partial<
      Pick<
        ListingSnapshot,
        | 'title'
        | 'description'
        | 'priceRub'
        | 'deliveryMode'
        | 'locationText'
        | 'durationText'
        | 'availabilityText'
        | 'active'
      >
    >,
    now: Date,
  ): void {
    if (patch.title !== undefined) {
      this.state.title = requireText(
        patch.title,
        3,
        120,
        'LISTING_TITLE_INVALID',
      );
    }
    if (patch.description !== undefined) {
      this.state.description = optionalText(
        patch.description,
        2000,
        'LISTING_DESCRIPTION_INVALID',
      );
    }
    if (patch.priceRub !== undefined) {
      this.state.priceRub = Rubles.create(patch.priceRub).value;
    }
    if (patch.deliveryMode !== undefined) {
      if (!['online', 'offline', 'both'].includes(patch.deliveryMode)) {
        throw new UzzValidationError('LISTING_DELIVERY_MODE_INVALID');
      }
      this.state.deliveryMode = patch.deliveryMode;
    }
    if (patch.locationText !== undefined) {
      this.state.locationText = optionalText(
        patch.locationText,
        160,
        'LISTING_LOCATION_INVALID',
      );
    }
    if (patch.durationText !== undefined) {
      this.state.durationText = optionalText(
        patch.durationText,
        120,
        'LISTING_DURATION_INVALID',
      );
    }
    if (patch.availabilityText !== undefined) {
      this.state.availabilityText = optionalText(
        patch.availabilityText,
        500,
        'LISTING_AVAILABILITY_INVALID',
      );
    }
    if (patch.active !== undefined) {
      this.state.active = patch.active;
    }
    this.state.updatedAt = new Date(now);
  }

  snapshot(): ListingSnapshot {
    return {
      ...this.state,
      createdAt: new Date(this.state.createdAt),
      updatedAt: new Date(this.state.updatedAt),
    };
  }
}

function requireText(
  value: string,
  min: number,
  max: number,
  code: string,
): string {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < min || length > max) {
    throw new UzzValidationError(code);
  }
  return normalized;
}

function optionalText(value: string, max: number, code: string): string {
  return requireText(value, 0, max, code);
}
