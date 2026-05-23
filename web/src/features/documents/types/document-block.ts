export type MeriterBlockType =
  | 'paragraph'
  | 'heading'
  | 'list-bullet'
  | 'list-numbered'
  | 'quote';

export function isMeriterBlockType(value: string): value is MeriterBlockType {
  return (
    value === 'paragraph' ||
    value === 'heading' ||
    value === 'list-bullet' ||
    value === 'list-numbered' ||
    value === 'quote'
  );
}
