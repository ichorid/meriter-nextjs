import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Button } from '@/components/ui/shadcn/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';

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

      <CardContent className="p-6 pt-0">
        <div className="space-y-3">
          {wallets.length === 0 ? (
            <p className="text-center text-base-content/60 py-4">
              No wallets yet
            </p>
          ) : (
            wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-3 shadow-none rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {wallet.currencyIcon && (
                    <Avatar className="w-10 h-10 text-sm">
                      <AvatarImage src={wallet.currencyIcon} alt={wallet.currency} />
                      <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
                        {wallet.currency ? wallet.currency.slice(0, 2).toUpperCase() : <User size={18} />}
                      </AvatarFallback>
                    </Avatar>
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
                      className="rounded-xl active:scale-[0.98]"
                    >
                      Top Up
                    </Button>
                  )}
                  {onWithdraw && wallet.balance > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onWithdraw(wallet.id)}
                      className="rounded-xl active:scale-[0.98]"
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
