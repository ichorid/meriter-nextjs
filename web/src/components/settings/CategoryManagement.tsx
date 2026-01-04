'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useInitializeDefaultCategories } from '@/hooks/api/useCategories';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Loader2, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';

export const CategoryManagement: React.FC = () => {
  const t = useTranslations('settings.categories');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((state) => state.addToast);
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const initializeDefaults = useInitializeDefaultCategories();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const sortedCategories = React.useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const handleStartEdit = (category: { id: string; name: string }) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (categoryId: string) => {
    if (!editName.trim()) {
      addToast(t('errors.nameRequired') || 'Name is required', 'error');
      return;
    }

    try {
      await updateCategory.mutateAsync({
        id: categoryId,
        name: editName.trim(),
      });
      setEditingId(null);
      setEditName('');
      addToast(t('updated') || 'Category updated', 'success');
    } catch (error) {
      console.error('Update category error:', error);
      addToast(t('errors.updateFailed') || 'Failed to update category', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newCategoryName.trim()) {
      addToast(t('errors.nameRequired') || 'Name is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      await createCategory.mutateAsync({
        name: newCategoryName.trim(),
      });
      setNewCategoryName('');
      addToast(t('created') || 'Category created', 'success');
    } catch (error: any) {
      console.error('Create category error:', error);
      addToast(error?.message || t('errors.createFailed') || 'Failed to create category', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm(t('confirmDelete') || 'Are you sure you want to delete this category? It will be removed from all publications.')) {
      return;
    }

    try {
      await deleteCategory.mutateAsync({ id: categoryId });
      addToast(t('deleted') || 'Category deleted', 'success');
    } catch (error) {
      console.error('Delete category error:', error);
      addToast(t('errors.deleteFailed') || 'Failed to delete category', 'error');
    }
  };

  const handleInitializeDefaults = async () => {
    if (!confirm(t('confirmInitialize') || 'This will create 10 default categories. Continue?')) {
      return;
    }

    try {
      await initializeDefaults.mutateAsync();
      addToast(t('initialized') || 'Default categories initialized', 'success');
    } catch (error: any) {
      console.error('Initialize defaults error:', error);
      addToast(error?.message || t('errors.initializeFailed') || 'Failed to initialize defaults', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/50" />
      </div>
    );
  }

  return (
    <CollapsibleSection
      title={t('title')}
      summary={t('description')}
      open={isOpen}
      setOpen={setIsOpen}
      right={
        (!categories || categories.length === 0) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleInitializeDefaults();
            }}
            disabled={initializeDefaults.isPending}
            className="gap-2"
          >
            {initializeDefaults.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('initializeDefaults')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Create new category */}
        <div className="space-y-2">
          <Label>{t('createNew')}</Label>
          <div className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t('categoryNamePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newCategoryName.trim()}
              className="gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t('create')}
            </Button>
          </div>
        </div>

        {/* Categories list */}
        <div className="space-y-2">
          <Label>{t('existingCategories')}</Label>
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-base-content/60 py-4">
              {t('noCategories')}
            </p>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-base-300 bg-base-100"
                >
                  {editingId === category.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(category.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveEdit(category.id)}
                        disabled={updateCategory.isPending || !editName.trim()}
                        className="gap-1"
                      >
                        {updateCategory.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={updateCategory.isPending}
                        className="gap-1"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-base-content">{category.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(category)}
                        className="gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        disabled={deleteCategory.isPending}
                        className="gap-1 text-error hover:text-error"
                      >
                        {deleteCategory.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
};


