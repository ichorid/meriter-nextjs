import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActingAsState {
  actingAsCommunityId: string | null;
}

interface ActingAsActions {
  setActingAs: (communityId: string | null) => void;
}

export const useActingAsStore = create<ActingAsState & ActingAsActions>()(
  persist(
    (set) => ({
      actingAsCommunityId: null,
      setActingAs: (communityId) => set({ actingAsCommunityId: communityId }),
    }),
    { name: 'meriter-acting-as' },
  ),
);
