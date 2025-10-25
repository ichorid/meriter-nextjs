import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  activeModal: string | null;
  activeSidebar: string | null;
  activeWithdrawPost: string | null;
  activeSlider: string | null;
  activeTab: string | null;
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
}

const initialState: UIState = {
  activeModal: null,
  activeSidebar: null,
  activeWithdrawPost: null,
  activeSlider: null,
  activeTab: null,
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
      }),
      { name: 'meriter-ui' }
    ),
    { name: 'UIStore' }
  )
);
