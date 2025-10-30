import { BottomPortal } from '@shared/components/bottom-portal';
import { FormPollCreate } from '@features/polls';

interface PollCreateModalProps {
  wallets: any[];
  onClose: () => void;
}

export function PollCreateModal({ wallets, onClose }: PollCreateModalProps) {
  return (
    <BottomPortal>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
      >
        <div className="pointer-events-auto">
          <FormPollCreate
            wallets={wallets}
            onSuccess={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </BottomPortal>
  );
}

