//uri := type.domainName://uid

export interface ITransa {
  uid: string;
  domainName: string;

  initiatorsActorUris: string[];
  subjectsActorUris: string[];
  spacesActorUris: string[];

  signatures: string[];

  value: number;

  type: string;
  focusAssetUri: string;
  relatedAssetsUris: string;

  meta: Record<string, unknown>;
}
