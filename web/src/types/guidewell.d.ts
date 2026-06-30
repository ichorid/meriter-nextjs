export {};

declare global {
  interface Window {
    Guidewell?: {
      open: () => void;
      close: () => void;
      toggle: () => void;
      unmount: () => void;
      mount?: unknown;
    };
    GuidewellConfig?: {
      apiBase?: string;
      apiKey?: string;
      fabText?: string;
      fabIcon?: string;
      lang?: string;
      theme?: 'light' | 'dark';
      primaryColor?: string;
      visitorColor?: string;
      chat?: string;
      ai?: boolean;
      aiProgram?: string;
    };
  }
}
