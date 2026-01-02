import { trpc } from '@/lib/trpc/client';

/**
 * Hook to get all categories
 */
export function useCategories() {
  return trpc.categories.getAll.useQuery();
}

/**
 * Hook to get category by ID
 */
export function useCategory(id: string) {
  return trpc.categories.getById.useQuery({ id });
}

/**
 * Hook to create a category (superadmin only)
 */
export function useCreateCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
    },
  });
}

/**
 * Hook to update a category (superadmin only)
 */
export function useUpdateCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
    },
  });
}

/**
 * Hook to delete a category (superadmin only)
 */
export function useDeleteCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
    },
  });
}

/**
 * Hook to initialize default categories (superadmin only)
 */
export function useInitializeDefaultCategories() {
  const utils = trpc.useUtils();
  return trpc.categories.initializeDefaults.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
    },
  });
}


