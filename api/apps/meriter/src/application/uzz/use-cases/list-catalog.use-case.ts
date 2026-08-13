import { ListingSnapshot } from '../../../domain/uzz/entities/listing';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export class ListCatalogUseCase {
  constructor(private readonly unitOfWork: UzzUnitOfWork) {}

  async execute(input: {
    communityId: string;
    authorId?: string;
  }): Promise<ListingSnapshot[]> {
    return this.unitOfWork.run(async (repositories) => {
      const listings = input.authorId
        ? await repositories.listings.listByAuthor(
            input.communityId,
            input.authorId,
          )
        : await repositories.listings.listActive(input.communityId);
      return listings.map((listing) => listing.snapshot());
    });
  }
}
