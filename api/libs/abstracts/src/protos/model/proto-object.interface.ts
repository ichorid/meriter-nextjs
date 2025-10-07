export interface IProtoField {
  _info: {
    type: string;
    parent_type: string;
    name: string;
    description: string;
    editor;
  };
  content: Record<string, unknown>;
}
