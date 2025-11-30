import { create } from "zustand";

export interface Toast {
    id: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
}

interface ToastState {
    toasts: Toast[];
    addToast: (message: string, type?: Toast["type"]) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    addToast: (message, type = "info") => {
        const id = `${Date.now()}-${Math.random()}`;
        console.log("Adding toast to store:", { id, message, type });
        set((state) => {
            const newToasts = [...state.toasts, { id, message, type }];
            console.log("Toast store updated, total toasts:", newToasts.length);
            return { toasts: newToasts };
        });
    },
    removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
