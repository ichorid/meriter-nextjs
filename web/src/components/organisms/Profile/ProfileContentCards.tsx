'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, MessageSquare, BarChart3, Briefcase } from 'lucide-react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { routes } from '@/lib/constants/routes';

interface ProfileContentCardsProps {
  userName?: string;
  userAvatar?: string | null;
  stats: {
    publications: number;
    comments: number;
    polls: number;
    projects: number;
  };
  isLoading?: boolean;
}

export function ProfileContentCards({
  userName,
  userAvatar,
  stats,
  isLoading = false,
}: ProfileContentCardsProps) {
  const t = useTranslations('home');
  const router = useRouter();

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
      route: `${routes.profile}/publications`,
    },
    {
      label: t('hero.stats.comments'),
      value: stats.comments,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      route: `${routes.profile}/comments`,
    },
    {
      label: t('hero.stats.polls'),
      value: stats.polls,
      icon: BarChart3,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      route: `${routes.profile}/polls`,
    },
    {
      label: t('hero.stats.projects'),
      value: stats.projects,
      icon: Briefcase,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      route: `${routes.profile}/projects`,
    },
  ];

  const handleCardClick = (route: string) => {
    router.push(route);
  };

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
            <button
              key={index}
              onClick={() => handleCardClick(stat.route)}
              className={`${stat.bgColor} rounded-xl p-4 border border-base-100/50 transition-all hover:shadow-md hover:scale-105 cursor-pointer text-left`}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

