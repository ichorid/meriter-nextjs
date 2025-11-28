'use client';

import { useToastStore } from '../stores/toast.store';
import { X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-right-full duration-300
            ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
              toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                toast.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
                  'bg-white border border-gray-200 text-gray-800'}
          `}
          role="alert"
        >
          <div className="flex-1 text-sm font-medium">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={16} className="opacity-60" />
          </button>
        </div>
      ))}
    </div>
  );
};
