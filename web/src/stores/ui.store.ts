import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type VotingTargetType = 'publication' | 'comment' | null;

interface VotingFormData {
  comment: string;
  delta: number;
  error: string;
}

interface UIState {
  activeModal: string | null;
  activeSidebar: string | null;
  activeWithdrawPost: string | null;
  activeSlider: string | null;
  activeTab: string | null;
  // Voting popup state - non-persistent
  activeVotingTarget: string | null;
  votingTargetType: VotingTargetType;
  activeVotingFormData: VotingFormData | null;
}

interface UIActions {
  openModal: (modal: string) => void;
  closeModal: () => void;
  toggleModal: (modal: string) => void;
  setActiveSidebar: (sidebar: string | null) => void;
  setActiveWithdrawPost: (id: string | null) => void;
  setActiveSlider: (id: string | null) => void;
  setActiveTab: (tab: string | null) => void;
  resetUI: () => void;
  // Voting popup actions
  openVotingPopup: (targetId: string, targetType: VotingTargetType) => void;
  closeVotingPopup: () => void;
  updateVotingFormData: (data: Partial<VotingFormData>) => void;
}

const initialState: UIState = {
  activeModal: null,
  activeSidebar: null,
  activeWithdrawPost: null,
  activeSlider: null,
  activeTab: null,
  activeVotingTarget: null,
  votingTargetType: null,
  activeVotingFormData: null,
};

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        openModal: (modal) => set({ activeModal: modal }),
        closeModal: () => set({ activeModal: null }),
        toggleModal: (modal) => 
          set((state) => ({ activeModal: state.activeModal === modal ? null : modal })),
        setActiveSidebar: (sidebar) => set({ activeSidebar: sidebar }),
        setActiveWithdrawPost: (id) => set({ activeWithdrawPost: id }),
        setActiveSlider: (id) => set({ activeSlider: id }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        resetUI: () => set(initialState),
        openVotingPopup: (targetId, targetType) => set({ 
          activeVotingTarget: targetId,
          votingTargetType: targetType,
          activeVotingFormData: { comment: '', delta: 0, error: '' }
        }),
        closeVotingPopup: () => set({ 
          activeVotingTarget: null,
          votingTargetType: null,
          activeVotingFormData: null
        }),
        updateVotingFormData: (data) => set((state) => ({
          activeVotingFormData: state.activeVotingFormData
            ? { ...state.activeVotingFormData, ...data }
            : { comment: '', delta: 0, error: '', ...data }
        })),
      }),
      { 
        name: 'meriter-ui',
        // Exclude voting popup state from persistence to prevent auto-show on page load
        partialize: (state) => ({
          activeModal: state.activeModal,
          activeSidebar: state.activeSidebar,
          activeTab: state.activeTab,
          // Don't persist activeSlider, activeWithdrawPost, or voting popup state
        }),
      }
    ),
    { name: 'UIStore' }
  )
);
