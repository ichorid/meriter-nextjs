export class FindTransactionDto {
  uid?: string;
  domainName?: string;

  initiatorsActorUris?: string[];
  subjectsActorUris?: string[];
  spacesActorUris?: string[];

  type?: string;
  focusAssetUri?: string;
  relatedAssetsUris?: string[];

  meta?: Record<string, unknown>;
}
