'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, MessageSquare, BarChart3, TrendingUp } from 'lucide-react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';

interface HeroSectionProps {
  userName?: string;
  userAvatar?: string | null;
  stats: {
    publications: number;
    comments: number;
    polls: number;
    updates: number;
  };
  isLoading?: boolean;
}

export function HeroSection({
  userName,
  userAvatar,
  stats,
  isLoading = false,
}: HeroSectionProps) {
  const t = useTranslations('home');

  const getGreeting = () => {
    const hour = new Date().getHours();
    // More accurate time boundaries
    if (hour >= 5 && hour < 12) return t('hero.greeting.morning');
    if (hour >= 12 && hour < 17) return t('hero.greeting.afternoon');
    if (hour >= 17 && hour < 22) return t('hero.greeting.evening');
    // Night: 22:00 - 04:59
    return t('hero.greeting.night');
  };

  const statCards = [
    {
      label: t('hero.stats.publications'),
      value: stats.publications,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: t('hero.stats.comments'),
      value: stats.comments,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: t('hero.stats.polls'),
      value: stats.polls,
      icon: BarChart3,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: t('hero.stats.updates'),
      value: stats.updates,
      icon: TrendingUp,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-brand-primary/5 via-base-100 to-brand-secondary/5 rounded-2xl p-6 mb-6 border border-base-300 dark:border-base-content/20">
      {/* Greeting Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <BrandAvatar
            src={userAvatar}
            alt={userName || 'User'}
            fallback={userName || 'U'}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-brand-text-primary dark:text-base-content">
              {getGreeting()}, {userName || t('hero.user')}!
            </h1>
            <p className="text-sm text-brand-text-secondary dark:text-base-content/80 mt-1">
              {t('hero.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`${stat.bgColor} rounded-xl p-4 border border-base-100/50 transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`${stat.color} w-5 h-5`} />
                <span className={`text-2xl font-bold ${stat.color}`}>
                  {isLoading ? '...' : stat.value}
                </span>
              </div>
              <p className="text-xs text-base-content/70 dark:text-base-content/70 font-medium">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

