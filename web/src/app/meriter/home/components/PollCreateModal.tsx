import { BrandModal } from '@/components/ui/BrandModal';
import { FormPollCreate } from '@features/polls';
import { useTranslations } from 'next-intl';

interface PollCreateModalProps {
  wallets: any[];
  onClose: () => void;
}

export function PollCreateModal({ wallets, onClose }: PollCreateModalProps) {
  const t = useTranslations('polls');

  return (
    <BrandModal
      isOpen={true}
      onClose={onClose}
      title={t('create.title') || 'Create Poll'}
      size="md"
    >
      <FormPollCreate
        wallets={wallets}
        onSuccess={onClose}
        onCancel={onClose}
      />
    </BrandModal>
  );
}

