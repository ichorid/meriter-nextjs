'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, Check, CheckCheck, Filter, Settings } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { InfoCard } from '@/components/ui/InfoCard';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Loader2 } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { 
  useNotifications,
  useInfiniteNotifications,
  useMarkAsRead, 
  useMarkAllAsRead, 
  useNotificationPreferences,
  useUpdatePreferences as useUpdatePrefs,
} from '@/hooks/api/useNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { NotificationType } from '@/types/api-v1';

export default function NotificationsPage() {
  const router = useRouter();
  const t = useTranslations('notifications');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const isAutoFetchingRef = useRef(false);
  const hasRefetchedOnLoadRef = useRef(false);

  const isMobile = useMediaQuery('(max-width: 640px)');
  const pageSize = isMobile ? 15 : 30; // Меньше данных на mobile
  
  const {
    data: notificationsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteNotifications(
    {
      unreadOnly: filter === 'unread',
      type: filter !== 'all' && filter !== 'unread' ? filter : undefined,
    },
    pageSize
  );

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Helper function to recursively fetch all remaining pages
  const fetchAllRemainingPages = React.useCallback(async () => {
    if (isAutoFetchingRef.current || isFetchingNextPage) {
      return;
    }

    isAutoFetchingRef.current = true;
    
    try {
      // Keep fetching while there are more pages
      let attempts = 0;
      const maxAttempts = 100; // Safety limit
      
      while (attempts < maxAttempts) {
        // Check current state - wait if currently fetching
        if (isFetchingNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        // Check if there's a next page
        if (!hasNextPage) {
          break;
        }
        
        // Fetch the next page
        await fetchNextPage();
        attempts++;
        
        // Wait for the fetch to complete before checking again
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } finally {
      isAutoFetchingRef.current = false;
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Refetch unread count when initial notifications fetch completes
  // This ensures the indicator updates immediately after backend auto-marks notifications as read
  useEffect(() => {
    if (!isLoading && notificationsData && !hasRefetchedOnLoadRef.current) {
      // Initial load completed - backend has auto-marked notifications as read
      // Refetch unread count to update the indicator immediately
      queryClient.refetchQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
      hasRefetchedOnLoadRef.current = true;
    }
  }, [isLoading, notificationsData, queryClient]);

  // Watch for when mutations succeed and auto-fetch remaining pages after refetch
  useEffect(() => {
    const mutationSucceeded = markAsRead.isSuccess || markAllAsRead.isSuccess;
    
    if (mutationSucceeded && !isAutoFetchingRef.current) {
      // First refetch the infinite query to get fresh data
      refetch().then(() => {
        // After refetch completes, wait a bit then fetch all remaining pages
        setTimeout(() => {
          fetchAllRemainingPages();
        }, 500);
      });
      
      // Reset mutation success flags
      if (markAsRead.isSuccess) markAsRead.reset();
      if (markAllAsRead.isSuccess) markAllAsRead.reset();
    }
  }, [markAsRead.isSuccess, markAllAsRead.isSuccess, refetch, fetchAllRemainingPages, markAsRead, markAllAsRead]);

  // Flatten notifications from all pages
  const notifications = useMemo(() => {
    return (notificationsData?.pages ?? [])
      .flatMap((page) => page.data || []);
  }, [notificationsData?.pages]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Infinite scroll trigger
  const observerTarget = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isFetchingNextPage,
    threshold: 200,
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.url) {
      router.push(notification.url);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'mention':
        return '💬';
      case 'reply':
        return '↩️';
      case 'vote':
        return '👍';
      case 'invite':
        return '📨';
      case 'comment':
        return '💭';
      case 'publication':
        return '📝';
      case 'poll':
        return '📊';
      case 'system':
        return '🔔';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('justNow');
      if (diffMins < 60) return `${diffMins}${t('minutesAgo')}`;
      if (diffHours < 24) return `${diffHours}${t('hoursAgo')}`;
      if (diffDays < 7) return `${diffDays}${t('daysAgo')}`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const filterOptions = [
    { value: 'all', label: t('filters.all') },
    { value: 'unread', label: t('filters.unread') },
    { value: 'mention', label: t('filters.mention') },
    { value: 'reply', label: t('filters.reply') },
    { value: 'vote', label: t('filters.vote') },
    { value: 'invite', label: t('filters.invite') },
  ];

  return (
    <AdaptiveLayout>
      <div className="flex flex-col h-full bg-base-100 overflow-hidden">
        <PageHeader
          title={t('title')}
          showBack={true}
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <Filter size={18} className="text-brand-text-secondary" />
              <BrandSelect
                value={filter}
                onChange={(value) => setFilter(value as typeof filter)}
                options={filterOptions}
                className="flex-1 sm:max-w-xs"
                fullWidth
              />
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsRead.isPending}
                  className="w-fit"
                >
                  <CheckCheck size={16} className="mr-1" />
                  {t('markAllRead')}
                </BrandButton>
              )}
              <BrandButton
                variant="outline"
                size="sm"
                onClick={() => setShowPreferences(!showPreferences)}
                className="w-fit"
              >
                <Settings size={16} />
              </BrandButton>
            </div>
          </div>

          {/* Notification Preferences (collapsible) */}
          {showPreferences && (
            <NotificationPreferencesPanel />
          )}

          {/* Notifications List */}
                    {isLoading ? (
                        <div className="space-y-2">
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : notifications.length > 0 ? (
                        <div className="space-y-2">
                            {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative ${!notification.read ? 'bg-blue-50/50' : ''}`}
                >
                  <InfoCard
                    title={notification.title}
                    subtitle={
                      [
                        notification.message,
                        notification.actor?.name,
                        notification.community?.name,
                        formatDate(notification.createdAt),
                      ]
                        .filter(Boolean)
                        .join(' • ')
                    }
                    icon={
                      <div className="text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>
                    }
                    rightElement={
                      <div className="flex items-center gap-1">
                        {notification.actor?.avatarUrl && (
                          <BrandAvatar
                            src={notification.actor.avatarUrl}
                            fallback={notification.actor.name}
                            size="sm"
                            className="mr-2"
                          />
                        )}
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead.mutate(notification.id);
                            }}
                            className="p-1 hover:bg-base-200 rounded-full transition-colors"
                            aria-label={t('ariaLabels.markAsRead')}
                          >
                            <Check size={16} className="text-base-content/60" />
                          </button>
                        )}
                      </div>
                    }
                    onClick={() => handleNotificationClick(notification)}
                    className={!notification.read ? 'border-blue-200' : ''}
                  />
                </div>
              ))}
              
              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="h-4" />
              
              {/* Loading indicator */}
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-base-content/60">
              <Bell className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
              <p className="font-medium">{t('noNotifications')}</p>
              <p className="text-sm mt-1">
                {filter === 'unread' 
                  ? t('noUnreadNotifications')
                  : t('noNotificationsDescription')}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdaptiveLayout>
  );
}

// Notification Preferences Panel Component
function NotificationPreferencesPanel() {
  const t = useTranslations('notifications');
  const { data: preferences, isLoading } = useNotificationPreferences();
  const { mutate: updatePreferences } = useUpdatePrefs();
  const [localPreferences, setLocalPreferences] = useState(preferences || {
    mentions: true,
    replies: true,
    votes: true,
    invites: true,
    comments: true,
    publications: true,
    polls: true,
    system: true,
  });

  React.useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleToggle = (key: keyof typeof localPreferences) => {
    const updated = { ...localPreferences, [key]: !localPreferences[key] };
    setLocalPreferences(updated);
    updatePreferences({ [key]: updated[key] });
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-base-200 rounded-xl border border-base-300">
        <Loader2 className="w-5 h-5 animate-spin text-brand-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-base-200 rounded-xl border border-base-300 space-y-3">
      <h3 className="font-semibold text-brand-text-primary">
        {t('preferences.title')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(localPreferences).map(([key, value]) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer p-2 hover:bg-base-200 rounded-lg transition-colors"
          >
            <input
              type="checkbox"
              checked={value}
              onChange={() => handleToggle(key as keyof typeof localPreferences)}
              className="w-4 h-4 text-brand-primary rounded"
            />
            <span className="text-sm text-brand-text-primary">
              {t(`preferences.${key}`) || key}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}


