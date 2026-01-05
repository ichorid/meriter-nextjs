'use client';

import React, { useState } from 'react';
import { useAboutContent, useAboutIntroduction, type AboutCategoryWithArticles } from '@/hooks/api/useAbout';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { AboutArticleItem } from './AboutArticleItem';

export function AboutContent() {
  const { data: categories, isLoading } = useAboutContent();
  const { data: introduction } = useAboutIntroduction();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-base-content/50" />
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        <p>Контент пока не добавлен</p>
      </div>
    );
  }

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      {introduction && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/80 bg-base-200/50 rounded-xl p-6">
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(introduction, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote'],
                ALLOWED_ATTR: ['href', 'target', 'rel'],
              }),
            }}
          />
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category) => (
          <AboutCategorySection
            key={category.id}
            category={category}
            isOpen={openCategories[category.id] ?? false}
            onToggle={() => toggleCategory(category.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface AboutCategorySectionProps {
  category: AboutCategoryWithArticles;
  isOpen: boolean;
  onToggle: () => void;
}

function AboutCategorySection({ category, isOpen, onToggle }: AboutCategorySectionProps) {
  const [openArticles, setOpenArticles] = useState<Record<string, boolean>>({});

  const toggleArticle = (articleId: string) => {
    setOpenArticles((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  return (
    <CollapsibleSection
      title={category.title}
      summary={category.description || `${category.articles.length} ${category.articles.length === 1 ? 'статья' : 'статей'}`}
      open={isOpen}
      setOpen={onToggle}
    >
      <div className="space-y-3 pt-2">
        {category.articles.length === 0 ? (
          <p className="text-sm text-base-content/60 py-4">Статей в этой категории пока нет</p>
        ) : (
          category.articles.map((article) => (
            <AboutArticleItem
              key={article.id}
              article={article}
              isOpen={openArticles[article.id] ?? false}
              onToggle={() => toggleArticle(article.id)}
            />
          ))
        )}
      </div>
    </CollapsibleSection>
  );
}

