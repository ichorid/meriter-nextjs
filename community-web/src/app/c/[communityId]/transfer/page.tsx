'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { AmountStepper } from '@/components/amount-stepper';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticImpact, hapticSuccess } from '@/lib/telegram-env';
import { useTelegramBackButton, useTelegramMainButton } from '@/lib/use-telegram-chrome';

type Step = 'receiver' | 'amount' | 'confirm';

function TransferPageInner({ communityId }: { communityId: string }) {
  const searchParams = useSearchParams();
  const preselectedTo = searchParams.get('to');

  const [step, setStep] = useState<Step>(preselectedTo ? 'amount' : 'receiver');
  const [receiverId, setReceiverId] = useState<string | null>(preselectedTo);
  const [amount, setAmount] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const meQuery = trpc.users.getMe.useQuery();
  const walletQuery = trpc.wallets.getByCommunity.useQuery({ communityId });
  const membersQuery = trpc.communities.getMembers.useQuery(
    { id: communityId, pageSize: 50 },
    { enabled: Boolean(communityId) },
  );
  const transfersQuery = trpc.meritTransfer.getByCommunity.useQuery({
    communityId,
    page: 1,
    pageSize: 10,
  });
  const utils = trpc.useUtils();

  const walletBalance = walletQuery.data?.balance ?? 0;
  const members = useMemo(
    () => membersQuery.data?.data ?? [],
    [membersQuery.data?.data],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (m.id === meQuery.data?.id) return false;
      if (!q) return true;
      const name = (m.displayName || m.username || m.id).toLowerCase();
      return name.includes(q);
    });
  }, [members, meQuery.data?.id, search]);

  const receiver = members.find((m) => m.id === receiverId);

  const transferMutation = trpc.meritTransfer.create.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setSuccess(
        `Переведено ${amount} заслуг → ${receiver?.displayName || receiver?.username || 'участнику'}.`,
      );
      setError(null);
      setStep('receiver');
      setReceiverId(null);
      setAmount(1);
      await utils.wallets.getByCommunity.invalidate({ communityId });
      await utils.meritTransfer.getByCommunity.invalidate({ communityId });
    },
    onError: (err) => {
      hapticError();
      const msg = err.message.includes('differ')
        ? 'Нельзя переводить заслуги самому себе'
        : err.message.includes('Insufficient') || err.message.includes('insufficient')
          ? 'Не хватает заслуг'
          : err.message || 'Не удалось перевести';
      setError(msg);
    },
  });

  const submitTransfer = useCallback(() => {
    if (!receiverId) return;
    if (amount <= 0) {
      hapticError();
      setError('Укажите положительную сумму');
      return;
    }
    if (amount > walletBalance) {
      hapticError();
      setError('Не хватает заслуг');
      return;
    }
    transferMutation.mutate({
      receiverId,
      communityContextId: communityId,
      amount,
      sourceWalletType: 'community',
      sourceContextId: communityId,
      targetWalletType: 'community',
      targetContextId: communityId,
    });
  }, [amount, communityId, receiverId, transferMutation, walletBalance]);

  const goBack = useCallback(() => {
    if (step === 'confirm') setStep('amount');
    else if (step === 'amount') setStep('receiver');
  }, [step]);

  const mainButtonActive = useTelegramMainButton({
    text: step === 'confirm' ? 'Перевести' : 'Далее',
    visible: step === 'amount' || step === 'confirm',
    enabled: step === 'amount' || (step === 'confirm' && !transferMutation.isPending),
    loading: transferMutation.isPending,
    onClick: () => {
      if (step === 'amount') setStep('confirm');
      else submitTransfer();
    },
  });

  const backButtonActive = useTelegramBackButton({
    visible: step === 'amount' || step === 'confirm',
    onClick: goBack,
  });

  return (
    <CommunityShell communityId={communityId} active="members" tgActive="transfer">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Перевод заслуг</h1>
          <p className="mt-1 text-sm text-stitch-muted">
            Баланс: {walletBalance} заслуг
          </p>
        </div>

        {success && (
          <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
            {success}
          </p>
        )}

        {step === 'receiver' && (
          <section className="space-y-3">
            <input
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
              placeholder="Поиск участника"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setReceiverId(member.id);
                      setStep('amount');
                      setSuccess(null);
                    }}
                    className="w-full rounded-xl border border-stitch-border bg-stitch-surface p-3 text-left hover:border-primary/50"
                  >
                    <p className="font-semibold">
                      {member.displayName || member.username || member.id}
                    </p>
                    {member.username && (
                      <p className="text-xs text-stitch-muted">@{member.username}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 'amount' && receiver && (
          <section className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-4">
            <p className="text-sm">
              Получатель:{' '}
              <span className="font-semibold">
                {receiver.displayName || receiver.username}
              </span>
            </p>
            <AmountStepper
              value={amount}
              min={1}
              max={Math.max(1, walletBalance)}
              onChange={setAmount}
            />
            <div className={`flex gap-2${mainButtonActive && backButtonActive ? ' hidden' : ''}`}>
              <button
                type="button"
                onClick={() => setStep('receiver')}
                className="flex-1 rounded-lg border border-stitch-border px-4 py-2 text-sm"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Далее
              </button>
            </div>
          </section>
        )}

        {step === 'confirm' && receiver && (
          <section className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-4">
            <p className="text-sm text-stitch-muted">Подтверждение</p>
            <p className="text-lg font-semibold">
              {amount} заслуг → {receiver.displayName || receiver.username}
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className={`flex gap-2${mainButtonActive && backButtonActive ? ' hidden' : ''}`}>
              <button
                type="button"
                onClick={() => setStep('amount')}
                className="flex-1 rounded-lg border border-stitch-border px-4 py-2 text-sm"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={transferMutation.isPending}
                onClick={submitTransfer}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Перевести
              </button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Недавние переводы</h2>
          {(transfersQuery.data?.data ?? []).slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-xs text-stitch-muted"
            >
              {t.amount} засл. · {t.sender?.displayName ?? t.senderId} →{' '}
              {t.receiver?.displayName ?? t.receiverId}
            </div>
          ))}
        </section>
      </div>
    </CommunityShell>
  );
}

export default function TransferPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <TransferPageInner communityId={communityId} />
    </AuthGate>
  );
}
