'use client';

import React, { useState } from 'react';
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
      addToast('Демо-данные инициализированы', 'success');
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
      addToast('Название категории обязательно', 'error');
      return;
    }

    try {
      await createCategory.mutateAsync({
        title: newCategoryTitle.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      setNewCategoryTitle('');
      setNewCategoryDescription('');
      addToast('Категория создана', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при создании категории', 'error');
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editCategoryTitle.trim()) {
      addToast('Название категории обязательно', 'error');
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
      addToast('Категория обновлена', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при обновлении категории', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию и все её статьи?')) {
      return;
    }

    try {
      await deleteCategory.mutateAsync({ id });
      addToast('Категория удалена', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при удалении категории', 'error');
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
      addToast('Заполните все поля', 'error');
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
      addToast('Статья создана', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при создании статьи', 'error');
    }
  };

  const handleUpdateArticle = async (id: string) => {
    if (!editArticleTitle.trim() || !editArticleContent.trim()) {
      addToast('Заполните все поля', 'error');
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
      addToast('Статья обновлена', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при обновлении статьи', 'error');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Удалить статью?')) {
      return;
    }

    try {
      await deleteArticle.mutateAsync({ id });
      addToast('Статья удалена', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при удалении статьи', 'error');
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
      addToast('Введение обновлено', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при сохранении введения', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Initialize Demo Data Button */}
      {(!categories || categories.length === 0) && (
        <div className="bg-base-200/50 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base-content mb-1">Инициализация демо-данных</h3>
              <p className="text-sm text-base-content/60">
                Создать демонстрационные категории и статьи для тестирования
              </p>
            </div>
            <Button
              onClick={() => {
                if (confirm('Создать демо-данные? Это добавит несколько категорий и статей.')) {
                  initializeDemoData.mutate();
                }
              }}
              disabled={initializeDemoData.isPending}
            >
              {initializeDemoData.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Инициализация...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Инициализировать
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Introduction Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-content">Введение</h3>
          {!editingIntroduction && (
            <Button variant="outline" size="sm" onClick={() => setEditingIntroduction(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
          )}
        </div>

        {editingIntroduction ? (
          <div className="space-y-3">
            <RichTextEditor
              content={introductionContent}
              onChange={setIntroductionContent}
              placeholder="Введите введение..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveIntroduction} disabled={setIntroduction.isPending}>
                {setIntroduction.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => {
                setEditingIntroduction(false);
                setIntroductionContent(introduction || '');
              }}>
                <X className="w-4 h-4 mr-2" />
                Отмена
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
        <h3 className="text-lg font-semibold text-base-content">Создать категорию</h3>
        <div className="space-y-2">
          <Label>Название категории</Label>
          <Input
            value={newCategoryTitle}
            onChange={(e) => setNewCategoryTitle(e.target.value)}
            placeholder="Введите название категории"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !createCategory.isPending) {
                handleCreateCategory();
              }
            }}
          />
          <Label>Описание (необязательно)</Label>
          <Textarea
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
            placeholder="Введите описание категории"
            rows={2}
          />
          <Button onClick={handleCreateCategory} disabled={createCategory.isPending || !newCategoryTitle.trim()}>
            {createCategory.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Создать категорию
          </Button>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4 border-t border-base-300 pt-6">
        <h3 className="text-lg font-semibold text-base-content">Категории</h3>
        {!categories || categories.length === 0 ? (
          <p className="text-sm text-base-content/60 py-4">Категории пока не созданы</p>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-base-300 rounded-xl p-4 space-y-4">
                {editingCategoryId === category.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Название</Label>
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
                      <Label>Описание</Label>
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
                        Статей: {category.articles.length}
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
                    <Label className="text-sm font-medium">Статьи</Label>
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
                      Добавить статью
                    </Button>
                  </div>

                  {/* Create Article Form */}
                  {newArticleCategoryId === category.id && (
                    <div className="bg-base-200/50 rounded-lg p-4 space-y-3">
                      <div>
                        <Label>Название статьи</Label>
                        <Input
                          value={newArticleTitle}
                          onChange={(e) => setNewArticleTitle(e.target.value)}
                          placeholder="Введите название статьи"
                        />
                      </div>
                      <div>
                        <Label>Содержание</Label>
                        <RichTextEditor
                          content={newArticleContent}
                          onChange={setNewArticleContent}
                          placeholder="Введите содержание статьи..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleCreateArticle} disabled={createArticle.isPending || !newArticleTitle.trim() || !newArticleContent.trim()}>
                          {createArticle.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Создать
                        </Button>
                        <Button variant="outline" onClick={() => setNewArticleCategoryId('')}>
                          <X className="w-4 h-4 mr-2" />
                          Отмена
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
                            <Label>Название</Label>
                            <Input
                              value={editArticleTitle}
                              onChange={(e) => setEditArticleTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Категория</Label>
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
                            <Label>Содержание</Label>
                            <RichTextEditor
                              content={editArticleContent}
                              onChange={setEditArticleContent}
                              placeholder="Введите содержание статьи..."
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

