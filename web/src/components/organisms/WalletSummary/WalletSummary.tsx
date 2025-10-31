import React from 'react';
import { Card, CardBody, CardHeader, CardTitle, Badge, Button } from '@/components/atoms';
import { Avatar } from '@/components/atoms';

// Frontend-specific Wallet interface for UI display
// Extends the base Wallet from shared-types
export interface WalletDisplay {
  id: string;
  currency: string;
  currencyIcon?: string;
  balance: number;
  pendingWithdrawals?: number;
}

export interface WalletSummaryProps {
  wallets: WalletDisplay[];
  onWithdraw?: (walletId: string) => void;
  onTopup?: (walletId: string) => void;
  totalBalance?: number;
  currency?: string;
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({
  wallets,
  onWithdraw,
  onTopup,
  totalBalance,
  currency,
}) => {
  const total = totalBalance || wallets.reduce((sum, w) => sum + w.balance, 0);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Wallets</CardTitle>
          {total > 0 && (
            <Badge variant="primary" size="md" className="font-bold">
              {total.toLocaleString()} {currency || 'tokens'}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardBody>
        <div className="space-y-3">
          {wallets.length === 0 ? (
            <p className="text-center text-base-content/60 py-4">
              No wallets yet
            </p>
          ) : (
            wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-3 border border-base-300 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {wallet.currencyIcon && (
                    <Avatar src={wallet.currencyIcon} alt={wallet.currency} size="md" />
                  )}
                  <div>
                    <div className="font-medium">{wallet.currency}</div>
                    <div className="text-sm text-base-content/60">
                      {wallet.balance.toLocaleString()} {wallet.currency}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {onTopup && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onTopup(wallet.id)}
                    >
                      Top Up
                    </Button>
                  )}
                  {onWithdraw && wallet.balance > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onWithdraw(wallet.id)}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
};
