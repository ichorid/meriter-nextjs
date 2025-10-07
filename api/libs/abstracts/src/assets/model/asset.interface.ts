export interface IAsset {
  uid: string;
  domainName: string;

  shortUid: string;
  longUid: string;

  protoContent: Record<string, any>;

  extUri: string;
  extFileUri: string;
  payload: Record<string, any>;

  viewableWithTags: string[];
  editableWithTags: string[];
  deleteableWithTags: string[];

  meta: Record<string, any>;
}
