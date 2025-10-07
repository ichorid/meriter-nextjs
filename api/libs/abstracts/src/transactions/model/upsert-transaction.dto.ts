export class UpsertTransactionDto {
  domainName?: string;

  initiatorsActorUris?: string[];
  subjectsActorUris?: string[];
  spacesActorUris?: string[];

  value?: number;

  type?: string;
  focusPublicationUri?: string;
  relatedPublicationsUris?: string[];

  meta: Record<string, unknown>;
}
