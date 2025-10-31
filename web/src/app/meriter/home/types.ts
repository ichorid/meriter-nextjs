export type HomeTab = 'publications' | 'comments' | 'polls' | 'updates';
export type SortOrder = 'recent' | 'voted';

export interface TabSortState {
  publications: SortOrder;
  comments: SortOrder;
  polls: SortOrder;
  updates: SortOrder;
}

