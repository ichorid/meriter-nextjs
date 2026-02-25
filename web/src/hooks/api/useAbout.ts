import { trpc } from '@/lib/trpc/client';

export interface AboutCategory {
  id: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AboutArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AboutCategoryWithArticles extends AboutCategory {
  articles: AboutArticle[];
}

/**
 * Hook to get all categories with articles
 */
export function useAboutContent() {
  return trpc.about.getAll.useQuery();
}

/**
 * Hook to get introduction text
 */
export function useAboutIntroduction() {
  return trpc.about.getIntroduction.useQuery();
}

/**
 * Hook to get category by ID with articles
 */
export function useAboutCategory(id: string) {
  return trpc.about.getCategoryById.useQuery({ id }, { enabled: !!id });
}

/**
 * Hook to get article by ID
 */
export function useAboutArticle(id: string) {
  return trpc.about.getArticleById.useQuery({ id }, { enabled: !!id });
}

/**
 * Hook to create a category (superadmin only)
 */
export function useCreateAboutCategory() {
  const utils = trpc.useUtils();
  return trpc.about.createCategory.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
    },
  });
}

/**
 * Hook to update a category (superadmin only)
 */
export function useUpdateAboutCategory() {
  const utils = trpc.useUtils();
  return trpc.about.updateCategory.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getCategoryById.invalidate();
    },
  });
}

/**
 * Hook to delete a category (superadmin only)
 */
export function useDeleteAboutCategory() {
  const utils = trpc.useUtils();
  return trpc.about.deleteCategory.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
    },
  });
}

/**
 * Hook to create an article (superadmin only)
 */
export function useCreateAboutArticle() {
  const utils = trpc.useUtils();
  return trpc.about.createArticle.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getCategoryById.invalidate();
    },
  });
}

/**
 * Hook to update an article (superadmin only)
 */
export function useUpdateAboutArticle() {
  const utils = trpc.useUtils();
  return trpc.about.updateArticle.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getCategoryById.invalidate();
      utils.about.getArticleById.invalidate();
    },
  });
}

/**
 * Hook to delete an article (superadmin only)
 */
export function useDeleteAboutArticle() {
  const utils = trpc.useUtils();
  return trpc.about.deleteArticle.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getCategoryById.invalidate();
    },
  });
}

/**
 * Hook to set introduction text (superadmin only)
 */
export function useSetAboutIntroduction() {
  const utils = trpc.useUtils();
  return trpc.about.setIntroduction.useMutation({
    onSuccess: () => {
      utils.about.getIntroduction.invalidate();
    },
  });
}

/**
 * Hook to reset "About" section to demo data (superadmin only).
 */
export function useResetAboutToDemoData() {
  const utils = trpc.useUtils();
  return trpc.about.resetToDemoData.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getIntroduction.invalidate();
    },
  });
}

