import { useEffect } from 'react';

/**
 * Generic hook for managing popup form data
 * Handles initialization and provides update handlers
 */
export function usePopupFormData<T extends { comment: string; error: string }>(options: {
  isOpen: boolean;
  formData: T | null;
  defaultFormData: T;
  updateFormData: (data: Partial<T>) => void;
}): {
  formData: T;
  handleCommentChange: (comment: string) => void;
  handleError: (error: string) => void;
  clearError: () => void;
} {
  const { isOpen, formData, defaultFormData, updateFormData } = options;

  // Initialize form data if not present
  useEffect(() => {
    if (isOpen && !formData) {
      updateFormData(defaultFormData);
    }
  }, [isOpen, formData, defaultFormData, updateFormData]);

  const currentFormData = formData || defaultFormData;

  const handleCommentChange = (comment: string) => {
    updateFormData({ comment, error: '' } as Partial<T>);
  };

  const handleError = (error: string) => {
    updateFormData({ error } as Partial<T>);
  };

  const clearError = () => {
    updateFormData({ error: '' } as Partial<T>);
  };

  return {
    formData: currentFormData,
    handleCommentChange,
    handleError,
    clearError,
  };
}

