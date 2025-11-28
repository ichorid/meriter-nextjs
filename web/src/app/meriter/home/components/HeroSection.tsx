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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('hero.stats.comments'),
      value: stats.comments,
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('hero.stats.polls'),
      value: stats.polls,
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: t('hero.stats.updates'),
      value: stats.updates,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-brand-primary/5 via-white to-brand-secondary/5 rounded-2xl p-6 mb-6 border border-gray-100">
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
            <h1 className="text-2xl font-bold text-brand-text-primary">
              {getGreeting()}, {userName || t('hero.user')}!
            </h1>
            <p className="text-sm text-brand-text-secondary mt-1">
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
              className={`${stat.bgColor} rounded-xl p-4 border border-white/50 transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`${stat.color} w-5 h-5`} />
                <span className={`text-2xl font-bold ${stat.color}`}>
                  {isLoading ? '...' : stat.value}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

