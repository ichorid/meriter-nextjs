'use client';

import { useToastStore } from '../stores/toast.store';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert shadow-lg ${
            toast.type === 'success' ? 'alert-success' :
            toast.type === 'error' ? 'alert-error' :
            toast.type === 'warning' ? 'alert-warning' :
            'alert-info'
          }`}
        >
          <span>{toast.message}</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

