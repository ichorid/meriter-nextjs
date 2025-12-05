export type HomeTab = 'publications' | 'comments' | 'polls';
export type SortOrder = 'recent' | 'voted';

export interface TabSortState {
  publications: SortOrder;
  comments: SortOrder;
  polls: SortOrder;
}

