'use client';

import { useToastStore } from '../stores/toast.store';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    toasts.forEach((toast) => {
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, 5000); // 5 seconds duration
      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  if (!mounted) return null;

  return (
    <div
      className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center pointer-events-none gap-2 px-4"
      style={{ zIndex: 9999 }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            layout
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm min-w-[300px] max-w-md
              ${toast.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800' :
                toast.type === 'success' ? 'bg-green-50/90 border-green-200 text-green-800' :
                  toast.type === 'warning' ? 'bg-yellow-50/90 border-yellow-200 text-yellow-800' :
                    'bg-blue-50/90 border-blue-200 text-blue-800'}
            `}
          >
            <div className="shrink-0">
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
              {(toast.type === 'info' || !toast.type) && <Info className="w-5 h-5 text-blue-600" />}
            </div>

            <p className="text-sm font-medium flex-1 leading-tight">
              {toast.message}
            </p>

            <button
              onClick={() => removeToast(toast.id)}
              className={`
                p-1 rounded-full transition-colors
                ${toast.type === 'error' ? 'hover:bg-red-100 text-red-600' :
                  toast.type === 'success' ? 'hover:bg-green-100 text-green-600' :
                    toast.type === 'warning' ? 'hover:bg-yellow-100 text-yellow-600' :
                      'hover:bg-blue-100 text-blue-600'}
              `}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
