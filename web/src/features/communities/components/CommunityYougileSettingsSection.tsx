'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';
import { formatMerits, formatNumber } from '@/lib/utils/currency';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

type YougileEventStatus =
  | 'post_created'
  | 'user_not_found'
  | 'duplicate'
  | 'column_mismatch'
  | 'no_assignee'
  | 'error';

interface CommunityYougileSettingsSectionProps {
  communityId: string;
}

function formatBoardLabel(title: string, projectTitle: string | null): string {
  return projectTitle ? `${projectTitle} / ${title}` : title;
}

interface YougileImportResult {
  scanned: number;
  created: number;
  alreadyImported: number;
  skipped: number;
}

function DashboardStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-base-100 px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-brand-text-secondary">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-brand-text-primary">{value}</div>
    </div>
  );
}

function formatEventTime(value: Date | string, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function CommunityYougileSettingsSection({
  communityId,
}: CommunityYougileSettingsSectionProps) {
  const t = useTranslations('pages.communitySettings.yougileSettingsSection');
  const locale = useLocale();
  const addToast = useToastStore((state) => state.addToast);
  const utils = trpc.useUtils();

  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [importResult, setImportResult] = useState<YougileImportResult | null>(null);

  const statusQuery = trpc.yougile.getStatus.useQuery({ communityId });
  const status = statusQuery.data;

  const isIntegrationActive = Boolean(status?.connected && status.enabled && !isEditing);
  const showConfigForm = Boolean(status?.connected && (!status.enabled || isEditing));

  const dashboardQuery = trpc.yougile.getDashboard.useQuery(
    { communityId },
    { enabled: isIntegrationActive },
  );

  const boardsQuery = trpc.yougile.getBoards.useQuery(
    { communityId },
    { enabled: showConfigForm },
  );

  const columnsQuery = trpc.yougile.getColumns.useQuery(
    { communityId, boardId: selectedBoardId },
    { enabled: showConfigForm && Boolean(selectedBoardId) },
  );

  useEffect(() => {
    if (status?.boardId) {
      setSelectedBoardId(status.boardId);
    }
    if (status?.columnId) {
      setSelectedColumnId(status.columnId);
    }
  }, [status?.boardId, status?.columnId]);

  const invalidateStatus = async () => {
    await utils.yougile.getStatus.invalidate({ communityId });
  };

  const connectMutation = trpc.yougile.connect.useMutation({
    onSuccess: async () => {
      setApiKey('');
      setConnectError(null);
      await invalidateStatus();
      addToast(t('connectSuccess'), 'success');
    },
    onError: (error) => {
      const message = extractErrorMessage(error, t('connectError'));
      if (message === 'YouGile rejected the API key') {
        setConnectError(t('connectApiKeyRejected'));
      } else {
        setConnectError(message);
      }
    },
  });

  const configureMutation = trpc.yougile.configure.useMutation({
    onSuccess: async () => {
      setIsEditing(false);
      await invalidateStatus();
      addToast(t('configureSuccess'), 'success');
    },
    onError: (error) => {
      addToast(extractErrorMessage(error, t('configureError')), 'error');
    },
  });

  const disconnectMutation = trpc.yougile.disconnect.useMutation({
    onSuccess: async () => {
      setSelectedBoardId('');
      setSelectedColumnId('');
      setIsEditing(false);
      setImportResult(null);
      await invalidateStatus();
      addToast(t('disconnectSuccess'), 'success');
    },
    onError: (error) => {
      addToast(extractErrorMessage(error, t('disconnectError')), 'error');
    },
  });

  const importMutation = trpc.yougile.importDone.useMutation({
    onSuccess: async (data) => {
      setImportResult(data);
      await Promise.all([
        utils.yougile.getDashboard.invalidate({ communityId }),
        utils.yougile.getStatus.invalidate({ communityId }),
      ]);
    },
    onError: (error) => {
      addToast(extractErrorMessage(error, t('importError')), 'error');
    },
  });

  const selectedBoard = useMemo(
    () => boardsQuery.data?.find((board) => board.id === selectedBoardId),
    [boardsQuery.data, selectedBoardId],
  );

  const selectedColumn = useMemo(
    () => columnsQuery.data?.find((column) => column.id === selectedColumnId),
    [columnsQuery.data, selectedColumnId],
  );

  const eventStatusLabel = (eventStatus: YougileEventStatus): string => {
    return t(`eventStatus.${eventStatus}`);
  };

  const handleConnect = () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      setConnectError(t('connectError'));
      return;
    }
    setConnectError(null);
    connectMutation.mutate({ communityId, apiKey: trimmed });
  };

  const handleConfigure = () => {
    if (!selectedBoard || !selectedColumn) {
      return;
    }
    configureMutation.mutate({
      communityId,
      boardId: selectedBoard.id,
      boardTitle: selectedBoard.title,
      columnId: selectedColumn.id,
      columnTitle: selectedColumn.title,
    });
  };

  const handleDisconnect = () => {
    if (!confirm(t('disconnectConfirm'))) {
      return;
    }
    disconnectMutation.mutate({ communityId });
  };

  const isBusy =
    connectMutation.isPending ||
    configureMutation.isPending ||
    disconnectMutation.isPending ||
    importMutation.isPending;

  if (statusQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="rounded-lg bg-base-200 p-6 shadow-none">
        <p className="text-sm text-destructive">{t('loadError')}</p>
      </div>
    );
  }

  const showActiveView = isIntegrationActive;
  const dashboard = dashboardQuery.data;
  const topPerformers = dashboard?.topPerformers ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-base-200 p-6 shadow-none">
        <h3 className="mb-2 text-lg font-semibold text-brand-text-primary">{t('title')}</h3>
        <p className="mb-6 text-sm text-brand-text-secondary">{t('description')}</p>

        {!status?.connected ? (
          <div className="space-y-4">
            <BrandFormControl label={t('apiKeyLabel')} error={connectError ?? undefined}>
              <Input
                type="password"
                autoComplete="off"
                className="h-11 max-w-md rounded-xl"
                placeholder={t('apiKeyPlaceholder')}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                disabled={isBusy}
              />
            </BrandFormControl>
            <div className="flex justify-end">
              <Button
                variant="default"
                size="lg"
                onClick={handleConnect}
                disabled={isBusy || apiKey.trim().length < 10}
                className="rounded-xl active:scale-[0.98]"
              >
                {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {connectMutation.isPending ? t('connecting') : t('connect')}
              </Button>
            </div>
          </div>
        ) : null}

        {status?.connected && showConfigForm ? (
          <div className="space-y-6">
            <BrandFormControl label={t('connectedKeyLabel')}>
              <Input
                type="text"
                readOnly
                className="h-11 max-w-md rounded-xl font-mono"
                value={status.apiKeyMask ?? ''}
                disabled
              />
            </BrandFormControl>

            <BrandFormControl label={t('boardLabel')}>
              <Select
                value={selectedBoardId || undefined}
                onValueChange={(value) => {
                  setSelectedBoardId(value);
                  setSelectedColumnId('');
                }}
                disabled={isBusy || boardsQuery.isLoading}
              >
                <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                  <SelectValue placeholder={t('boardPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(boardsQuery.data ?? []).map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {formatBoardLabel(board.title, board.projectTitle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BrandFormControl>

            <BrandFormControl label={t('columnLabel')}>
              <Select
                value={selectedColumnId || undefined}
                onValueChange={setSelectedColumnId}
                disabled={isBusy || !selectedBoardId || columnsQuery.isLoading}
              >
                <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                  <SelectValue placeholder={t('columnPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(columnsQuery.data ?? []).map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BrandFormControl>

            <p className="max-w-md text-sm text-brand-text-secondary">{t('targetCommunityNote')}</p>

            <div className="flex justify-end gap-2">
              {isEditing ? (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setIsEditing(false);
                    if (status.boardId) {
                      setSelectedBoardId(status.boardId);
                    }
                    if (status.columnId) {
                      setSelectedColumnId(status.columnId);
                    }
                  }}
                  disabled={isBusy}
                  className="rounded-xl"
                >
                  {t('cancelEdit')}
                </Button>
              ) : null}
              <Button
                variant="default"
                size="lg"
                onClick={handleConfigure}
                disabled={isBusy || !selectedBoardId || !selectedColumnId}
                className="rounded-xl active:scale-[0.98]"
              >
                {configureMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {configureMutation.isPending ? t('enabling') : t('enableIntegration')}
              </Button>
            </div>
          </div>
        ) : null}

        {showActiveView ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default" className="rounded-md font-normal">
                {t('integrationActive')}
              </Badge>
            </div>

            {dashboardQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
              </div>
            ) : null}

            {dashboardQuery.isError ? (
              <p className="text-sm text-destructive">{t('dashboardLoadError')}</p>
            ) : null}

            {!dashboardQuery.isLoading && !dashboardQuery.isError && dashboard ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DashboardStatCard
                    label={t('statTasksProcessed')}
                    value={formatNumber(dashboard.tasksProcessed)}
                  />
                  <DashboardStatCard
                    label={t('statPostsCreated')}
                    value={formatNumber(dashboard.postsCreated)}
                  />
                  <DashboardStatCard
                    label={t('statTotalScore')}
                    value={formatMerits(dashboard.totalScore)}
                  />
                  <DashboardStatCard
                    label={t('statTotalEarned')}
                    value={formatMerits(dashboard.totalEarned)}
                  />
                </div>

                {topPerformers.length > 0 ? (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-brand-text-primary">
                      {t('topPerformersTitle')}
                    </h4>
                    <ul className="space-y-2">
                      {topPerformers.map((performer) => (
                        <li
                          key={performer.userId}
                          className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-base-100 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-brand-text-primary">
                            {performer.displayName}
                          </span>
                          <span className="text-brand-text-secondary">
                            {t('topPerformerPosts', { count: performer.posts })}
                            {' · '}
                            {t('topPerformerScore', { score: formatMerits(performer.score) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 text-sm text-brand-text-primary">
              <p>
                <span className="text-brand-text-secondary">{t('boardLabel')}: </span>
                {status?.boardTitle ?? '—'}
              </p>
              <p>
                <span className="text-brand-text-secondary">{t('columnLabel')}: </span>
                {status?.columnTitle ?? '—'}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-brand-text-secondary">{t('importDescription')}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => importMutation.mutate({ communityId })}
                  disabled={isBusy}
                  className="rounded-xl"
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {importMutation.isPending ? t('importRunning') : t('importButton')}
                </Button>
              </div>
              {importResult ? (
                <p className="text-sm text-brand-text-primary">
                  {t('importResult', {
                    created: importResult.created,
                    alreadyImported: importResult.alreadyImported,
                    skipped: importResult.skipped,
                    scanned: importResult.scanned,
                  })}
                </p>
              ) : null}
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-brand-text-primary">
                {t('recentEvents')}
              </h4>
              {(status?.eventLog ?? []).length === 0 ? (
                <p className="text-sm text-brand-text-secondary">{t('noEvents')}</p>
              ) : (
                <ul className="space-y-3">
                  {(status?.eventLog ?? []).map((entry, index) => (
                    <li
                      key={`${entry.at instanceof Date ? entry.at.toISOString() : String(entry.at)}-${index}`}
                      className="rounded-xl border border-border bg-base-100 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-brand-text-primary">
                          {eventStatusLabel(entry.status as YougileEventStatus)}
                        </span>
                        <span className="text-xs text-brand-text-secondary">
                          {formatEventTime(entry.at, locale)}
                        </span>
                      </div>
                      {entry.taskTitle ? (
                        <p className="mt-1 text-brand-text-secondary">{entry.taskTitle}</p>
                      ) : null}
                      {entry.detail ? (
                        <p className="mt-1 text-xs text-brand-text-secondary">{entry.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
                className="rounded-xl"
              >
                {t('editSettings')}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={handleDisconnect}
                disabled={isBusy}
                className="rounded-xl active:scale-[0.98]"
              >
                {disconnectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {disconnectMutation.isPending ? t('disconnecting') : t('disconnect')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
