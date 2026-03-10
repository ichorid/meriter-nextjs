'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectMembers } from '@/hooks/api/useProjects';
import { useTransferAdmin } from '@/hooks/api/useProjects';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';

interface TransferAdminDialogProps {
  projectId: string;
  projectName: string;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferAdminDialog({
  projectId,
  projectName,
  currentUserId,
  open,
  onOpenChange,
}: TransferAdminDialogProps) {
  const t = useTranslations('projects');
  const { data: membersData } = useProjectMembers(projectId, { limit: 100 });
  const members = membersData?.data ?? [];
  const transferAdmin = useTransferAdmin();
  const [newLeadId, setNewLeadId] = useState<string>('');

  const candidates = members.filter(
    (m: { id?: string; userId?: string; role?: string }) => {
      const id = m.id ?? m.userId ?? '';
      return id !== currentUserId && m.role !== 'lead';
    },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadId) return;
    try {
      await transferAdmin.mutateAsync({ projectId, newLeadId });
      setNewLeadId('');
      onOpenChange(false);
    } catch {
      // Toast in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transferAdmin', { defaultValue: 'Transfer project admin' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('transferAdminDescription', {
              defaultValue: 'Select a project member to become the new lead. You will become a regular member. Founder share stays with the original creator.',
            })}
          </p>
          <div>
            <Label>{t('newLead', { defaultValue: 'New lead' })}</Label>
            <Select value={newLeadId} onValueChange={setNewLeadId} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t('selectMember', { defaultValue: 'Select member' })} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m: { id?: string; userId?: string; displayName?: string }) => {
                  const id = m.id ?? m.userId ?? '';
                  const label = m.displayName ?? id.slice(0, 8);
                  return (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={transferAdmin.isPending || !newLeadId}>
              {transferAdmin.isPending ? '…' : t('transferAdminConfirm', { defaultValue: 'Transfer' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
