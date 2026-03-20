'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useProjectMembers } from '@/hooks/api/useProjects';
import { useUpdateTicket } from '@/hooks/api/useTickets';
import { routes } from '@/lib/constants/routes';
import type { TicketStatus } from '@meriter/shared-types';

export interface TicketPostPanelPublication {
  id: string;
  ticketStatus?: TicketStatus | string;
  isNeutralTicket?: boolean;
  title?: string;
  description?: string;
  content?: string;
  beneficiaryId?: string;
  meta?: {
    beneficiary?: { name?: string; photoUrl?: string; username?: string };
  };
  permissions?: { canEdit?: boolean };
  ticketActivityLog?: Array<{
    at: string;
    actorId: string;
    action: string;
    detail?: Record<string, unknown>;
    actor?: { id: string; name?: string };
  }>;
  editHistory?: Array<{
    editedAt: string;
    editedBy: string;
    editor?: { id: string; name?: string };
  }>;
}

export interface TicketPostPanelProps {
  communityId: string;
  communityIsProject: boolean;
  publication: TicketPostPanelPublication;
  onInvalidate: () => void;
  /** Strip card + status; only back / edit row (hero shows status). */
  layout?: 'default' | 'actionsOnly';
}

export function TicketPostPanel({
  communityId,
  communityIsProject,
  publication,
  onInvalidate,
  layout = 'default',
}: TicketPostPanelProps) {
  const t = useTranslations('projects');
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(publication.title ?? '');
  const [description, setDescription] = useState(publication.description ?? '');
  const [content, setContent] = useState(publication.content ?? '');
  const [beneficiaryId, setBeneficiaryId] = useState(publication.beneficiaryId ?? '');
  const updateTicket = useUpdateTicket();
  const { data: membersData } = useProjectMembers(communityId, { limit: 100 });
  const members = membersData?.data ?? [];

  const canModerate = Boolean(publication.permissions?.canEdit);
  const blockAssigneeChange = Boolean(
    publication.isNeutralTicket && publication.ticketStatus === 'open',
  );

  const assigneeSelectItems = useMemo(() => {
    type M = { id?: string; userId?: string; displayName?: string };
    const normalized = (members as M[]).map((m) => {
      const id = m.id ?? m.userId ?? '';
      return { id, label: m.displayName ?? (id ? id.slice(0, 8) : '') };
    }).filter((x) => x.id.length > 0);
    const ids = new Set(normalized.map((x) => x.id));
    const bid = publication.beneficiaryId?.trim() ?? '';
    if (bid && !ids.has(bid)) {
      const name = publication.meta?.beneficiary?.name?.trim();
      normalized.unshift({
        id: bid,
        label: name && name.length > 0 ? name : bid.slice(0, 8),
      });
    }
    return normalized;
  }, [members, publication.beneficiaryId, publication.meta?.beneficiary?.name]);

  const openEdit = () => {
    setTitle(publication.title ?? '');
    setDescription(publication.description ?? '');
    setContent(publication.content ?? '');
    setBeneficiaryId(publication.beneficiaryId ?? '');
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    const payload: {
      ticketId: string;
      title?: string;
      description?: string;
      content?: string;
      beneficiaryId?: string;
    } = { ticketId: publication.id };

    const tTrim = title.trim();
    const dTrim = description.trim();
    const cTrim = content.trim();
    if (tTrim !== (publication.title ?? '').trim()) {
      payload.title = tTrim;
    }
    if (dTrim !== (publication.description ?? '').trim()) {
      payload.description = dTrim;
    }
    if (cTrim !== (publication.content ?? '').trim()) {
      payload.content = cTrim;
    }
    if (!blockAssigneeChange && beneficiaryId && beneficiaryId !== publication.beneficiaryId) {
      payload.beneficiaryId = beneficiaryId;
    }

    const hasChange =
      payload.title !== undefined ||
      payload.description !== undefined ||
      payload.content !== undefined ||
      payload.beneficiaryId !== undefined;
    if (!hasChange) {
      setEditOpen(false);
      return;
    }

    updateTicket.mutate(payload, {
      onSuccess: () => {
        setEditOpen(false);
        onInvalidate();
      },
    });
  };

  const actionsRow = (
    <div className="flex flex-wrap items-center gap-2">
      {communityIsProject && (
        <Button variant="default" size="sm" className="h-9 rounded-lg" asChild>
          <Link href={routes.project(communityId)}>{t('backToProject')}</Link>
        </Button>
      )}
      {canModerate && (
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={openEdit}>
          {t('editTask')}
        </Button>
      )}
    </div>
  );

  const dialog = (
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editTask')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="ticket-edit-title">{t('taskFieldTitle')}</Label>
              <Input
                id="ticket-edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ticket-edit-desc">{t('description')}</Label>
              <Textarea
                id="ticket-edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="ticket-edit-content">{t('taskFieldBody')}</Label>
              <Textarea
                id="ticket-edit-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 min-h-[120px]"
                required
              />
            </div>
            {!blockAssigneeChange && (
              <div>
                <Label htmlFor="ticket-edit-ben">{t('beneficiary')}</Label>
                <Select
                  value={beneficiaryId.length > 0 ? beneficiaryId : undefined}
                  onValueChange={setBeneficiaryId}
                >
                  <SelectTrigger id="ticket-edit-ben" className="mt-1">
                    <SelectValue placeholder={t('selectAssignee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {assigneeSelectItems.map(({ id, label }) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {blockAssigneeChange && (
              <p className="text-xs text-muted-foreground">{t('taskAssigneeLockedOpenNeutral')}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={updateTicket.isPending || !content.trim()}>
              {t('saveTaskEdits')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  if (layout === 'actionsOnly') {
    return (
      <div className="mb-4">
        {actionsRow}
        {dialog}
      </div>
    );
  }

  const status = (publication.ticketStatus ?? 'in_progress') as TicketStatus;

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={status} className="border-white/10 bg-white/10" />
          {communityIsProject && (
            <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
              <Link href={routes.project(communityId)}>{t('backToProject')}</Link>
            </Button>
          )}
        </div>
        {canModerate && (
          <Button type="button" variant="secondary" size="sm" className="h-8 rounded-lg" onClick={openEdit}>
            {t('editTask')}
          </Button>
        )}
      </div>

      {dialog}
    </div>
  );
}
