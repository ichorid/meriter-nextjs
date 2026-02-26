'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAboutContent, useAboutIntroduction, useCreateAboutCategory, useUpdateAboutCategory, useDeleteAboutCategory, useCreateAboutArticle, useUpdateAboutArticle, useDeleteAboutArticle, useSetAboutIntroduction, type AboutCategoryWithArticles, type AboutArticle } from '@/hooks/api/useAbout';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { Loader2, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import DOMPurify from 'dompurify';

export function AboutAdminPanel() {
  const t = useTranslations('about.admin');
  const { data: categories, isLoading } = useAboutContent();
  const { data: introduction } = useAboutIntroduction();
  const addToast = useToastStore((state) => state.addToast);
  const createCategory = useCreateAboutCategory();
  const updateCategory = useUpdateAboutCategory();
  const deleteCategory = useDeleteAboutCategory();
  const createArticle = useCreateAboutArticle();
  const updateArticle = useUpdateAboutArticle();
  const deleteArticle = useDeleteAboutArticle();
  const setIntroduction = useSetAboutIntroduction();
  const utils = trpc.useUtils();
  const initializeDemoData = trpc.about.initializeDemoData.useMutation({
    onSuccess: () => {
      utils.about.getAll.invalidate();
      utils.about.getIntroduction.invalidate();
      addToast(t('demoInitialized'), 'success');
    },
  });

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editingIntroduction, setEditingIntroduction] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editCategoryTitle, setEditCategoryTitle] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleContent, setNewArticleContent] = useState('');
  const [newArticleCategoryId, setNewArticleCategoryId] = useState<string>('');
  const [editArticleTitle, setEditArticleTitle] = useState('');
  const [editArticleContent, setEditArticleContent] = useState('');
  const [editArticleCategoryId, setEditArticleCategoryId] = useState<string>('');
  const [introductionContent, setIntroductionContent] = useState(introduction || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/50" />
      </div>
    );
  }

  const handleCreateCategory = async () => {
    if (!newCategoryTitle.trim()) {
      addToast(t('categoryNameRequired'), 'error');
      return;
    }

    try {
      await createCategory.mutateAsync({
        title: newCategoryTitle.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      setNewCategoryTitle('');
      setNewCategoryDescription('');
      addToast(t('categoryCreated'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('categoryCreateError'), 'error');
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editCategoryTitle.trim()) {
      addToast(t('categoryNameRequired'), 'error');
      return;
    }

    try {
      await updateCategory.mutateAsync({
        id,
        title: editCategoryTitle.trim(),
        description: editCategoryDescription.trim() || undefined,
      });
      setEditingCategoryId(null);
      setEditCategoryTitle('');
      setEditCategoryDescription('');
      addToast(t('categoryUpdated'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('categoryUpdateError'), 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('confirmDeleteCategory'))) {
      return;
    }

    try {
      await deleteCategory.mutateAsync({ id });
      addToast(t('categoryDeleted'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('categoryDeleteError'), 'error');
    }
  };

  const handleStartEditCategory = (category: AboutCategoryWithArticles) => {
    setEditingCategoryId(category.id);
    setEditCategoryTitle(category.title);
    setEditCategoryDescription(category.description || '');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryTitle('');
    setEditCategoryDescription('');
  };

  const handleCreateArticle = async () => {
    if (!newArticleTitle.trim() || !newArticleContent.trim() || !newArticleCategoryId) {
      addToast(t('fillAllFields'), 'error');
      return;
    }

    try {
      await createArticle.mutateAsync({
        categoryId: newArticleCategoryId,
        title: newArticleTitle.trim(),
        content: newArticleContent.trim(),
      });
      setNewArticleTitle('');
      setNewArticleContent('');
      setNewArticleCategoryId('');
      addToast(t('articleCreated'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('articleCreateError'), 'error');
    }
  };

  const handleUpdateArticle = async (id: string) => {
    if (!editArticleTitle.trim() || !editArticleContent.trim()) {
      addToast(t('fillAllFields'), 'error');
      return;
    }

    try {
      await updateArticle.mutateAsync({
        id,
        title: editArticleTitle.trim(),
        content: editArticleContent.trim(),
        categoryId: editArticleCategoryId || undefined,
      });
      setEditingArticleId(null);
      setEditArticleTitle('');
      setEditArticleContent('');
      setEditArticleCategoryId('');
      addToast(t('articleUpdated'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('articleUpdateError'), 'error');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm(t('confirmDeleteArticle'))) {
      return;
    }

    try {
      await deleteArticle.mutateAsync({ id });
      addToast(t('articleDeleted'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('articleDeleteError'), 'error');
    }
  };

  const handleStartEditArticle = (article: AboutArticle) => {
    setEditingArticleId(article.id);
    setEditArticleTitle(article.title);
    setEditArticleContent(article.content);
    setEditArticleCategoryId(article.categoryId);
  };

  const handleCancelEditArticle = () => {
    setEditingArticleId(null);
    setEditArticleTitle('');
    setEditArticleContent('');
    setEditArticleCategoryId('');
  };

  const handleSaveIntroduction = async () => {
    try {
      await setIntroduction.mutateAsync({ content: introductionContent });
      setEditingIntroduction(false);
      addToast(t('introductionUpdated'), 'success');
    } catch (error: any) {
      addToast(error?.message || t('introductionSaveError'), 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Initialize Demo Data Button */}
      {(!categories || categories.length === 0) && (
        <div className="bg-base-200/50 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base-content mb-1">{t('initDemoTitle')}</h3>
              <p className="text-sm text-base-content/60">
                {t('initDemoDescription')}
              </p>
            </div>
            <Button
              onClick={() => {
                if (confirm(t('confirmCreateDemo'))) {
                  initializeDemoData.mutate();
                }
              }}
              disabled={initializeDemoData.isPending}
            >
              {initializeDemoData.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('initializing')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('initButton')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Introduction Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-content">{t('introductionLabel')}</h3>
          {!editingIntroduction && (
            <Button variant="outline" size="sm" onClick={() => setEditingIntroduction(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              {t('editButton')}
            </Button>
          )}
        </div>

        {editingIntroduction ? (
          <div className="space-y-3">
            <RichTextEditor
              content={introductionContent}
              onChange={setIntroductionContent}
              placeholder={t('introductionPlaceholder')}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveIntroduction} disabled={setIntroduction.isPending}>
                {setIntroduction.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {t('save')}
              </Button>
              <Button variant="outline" onClick={() => {
                setEditingIntroduction(false);
                setIntroductionContent(introduction || '');
              }}>
                <X className="w-4 h-4 mr-2" />
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          introduction && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/80 bg-base-200/50 rounded-xl p-4">
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(introduction, {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote'],
                    ALLOWED_ATTR: ['href', 'target', 'rel'],
                  }),
                }}
              />
            </div>
          )
        )}
      </div>

      {/* Create New Category */}
      <div className="space-y-3 border-t border-base-300 pt-6">
        <h3 className="text-lg font-semibold text-base-content">{t('createCategoryHeading')}</h3>
        <div className="space-y-2">
          <Label>{t('categoryNameLabel')}</Label>
          <Input
            value={newCategoryTitle}
            onChange={(e) => setNewCategoryTitle(e.target.value)}
            placeholder={t('categoryNamePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !createCategory.isPending) {
                handleCreateCategory();
              }
            }}
          />
          <Label>{t('descriptionOptional')}</Label>
          <Textarea
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
            placeholder={t('categoryDescriptionPlaceholder')}
            rows={2}
          />
          <Button onClick={handleCreateCategory} disabled={createCategory.isPending || !newCategoryTitle.trim()}>
            {createCategory.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {t('createCategoryButton')}
          </Button>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4 border-t border-base-300 pt-6">
        <h3 className="text-lg font-semibold text-base-content">{t('categoriesHeading')}</h3>
        {!categories || categories.length === 0 ? (
          <p className="text-sm text-base-content/60 py-4">{t('noCategoriesYet')}</p>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-base-300 rounded-xl p-4 space-y-4">
                {editingCategoryId === category.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label>{t('nameLabel')}</Label>
                      <Input
                        value={editCategoryTitle}
                        onChange={(e) => setEditCategoryTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateCategory(category.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEditCategory();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>{t('descriptionLabel')}</Label>
                      <Textarea
                        value={editCategoryDescription}
                        onChange={(e) => setEditCategoryDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleUpdateCategory(category.id)} disabled={updateCategory.isPending}>
                        {updateCategory.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleCancelEditCategory}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base-content">{category.title}</h4>
                      {category.description && (
                        <p className="text-sm text-base-content/60 mt-1">{category.description}</p>
                      )}
                      <p className="text-xs text-base-content/50 mt-2">
                        {t('articlesCount', { count: category.articles.length })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleStartEditCategory(category)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={deleteCategory.isPending}
                        className="text-error hover:text-error"
                      >
                        {deleteCategory.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Articles in Category */}
                <div className="space-y-3 pl-4 border-l-2 border-base-300">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{t('articlesLabel')}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewArticleCategoryId(category.id);
                        setNewArticleTitle('');
                        setNewArticleContent('');
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('addArticle')}
                    </Button>
                  </div>

                  {/* Create Article Form */}
                  {newArticleCategoryId === category.id && (
                    <div className="bg-base-200/50 rounded-lg p-4 space-y-3">
                      <div>
                        <Label>{t('articleTitleLabel')}</Label>
                        <Input
                          value={newArticleTitle}
                          onChange={(e) => setNewArticleTitle(e.target.value)}
                          placeholder={t('articleTitlePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label>{t('contentLabel')}</Label>
                        <RichTextEditor
                          content={newArticleContent}
                          onChange={setNewArticleContent}
                          placeholder={t('articleContentPlaceholder')}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleCreateArticle} disabled={createArticle.isPending || !newArticleTitle.trim() || !newArticleContent.trim()}>
                          {createArticle.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          {t('createButton')}
                        </Button>
                        <Button variant="outline" onClick={() => setNewArticleCategoryId('')}>
                          <X className="w-4 h-4 mr-2" />
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Articles List */}
                  {category.articles.map((article) => (
                    <div key={article.id} className="bg-base-200/30 rounded-lg p-3 space-y-2">
                      {editingArticleId === article.id ? (
                        <div className="space-y-3">
                          <div>
                            <Label>{t('nameLabel')}</Label>
                            <Input
                              value={editArticleTitle}
                              onChange={(e) => setEditArticleTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>{t('categoryLabel')}</Label>
                            <select
                              value={editArticleCategoryId}
                              onChange={(e) => setEditArticleCategoryId(e.target.value)}
                              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            >
                              {categories?.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>{t('contentLabel')}</Label>
                            <RichTextEditor
                              content={editArticleContent}
                              onChange={setEditArticleContent}
                              placeholder={t('articleContentPlaceholder')}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleUpdateArticle(article.id)} disabled={updateArticle.isPending}>
                              {updateArticle.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </Button>
                            <Button variant="outline" onClick={handleCancelEditArticle}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-base-content">{article.title}</h5>
                            <div className="prose prose-xs dark:prose-invert max-w-none text-base-content/70 mt-2 line-clamp-2">
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(article.content, {
                                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
                                  }),
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button variant="ghost" size="sm" onClick={() => handleStartEditArticle(article)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteArticle(article.id)}
                              disabled={deleteArticle.isPending}
                              className="text-error hover:text-error"
                            >
                              {deleteArticle.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

