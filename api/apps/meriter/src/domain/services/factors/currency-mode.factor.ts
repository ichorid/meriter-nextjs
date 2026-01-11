import { Injectable, Logger } from '@nestjs/common';
import { SocialCurrencyConstraintFactor } from './social-currency-constraint.factor';
import { ContextCurrencyModeFactor } from './context-currency-mode.factor';
import { CurrencyModeResult, VoteFactorContext } from './vote-factor.types';

/**
 * Currency Mode Composer
 * 
 * Composes Factor 2 (Social Currency Constraint) and Factor 3 (Context Currency Mode)
 * into final currency mode result.
 * 
 * Composition logic: If Factor 2 applies (social constraint) → use it, otherwise use Factor 3 (context)
 */
@Injectable()
export class CurrencyModeFactor {
  private readonly logger = new Logger(CurrencyModeFactor.name);

  constructor(
    private socialConstraintFactor: SocialCurrencyConstraintFactor,
    private contextCurrencyModeFactor: ContextCurrencyModeFactor,
  ) {}

  /**
   * Evaluate currency mode by composing social and context factors
   * 
   * @param context Vote factor context
   * @returns Composed currency mode result
   */
  async evaluate(context: VoteFactorContext): Promise<CurrencyModeResult> {
    // Evaluate Factor 2: Social Currency Constraint
    const socialResult = await this.socialConstraintFactor.evaluate(context);

    // If social constraint applies → use it (takes priority)
    if (socialResult.constraint === 'wallet-only') {
      this.logger.debug(
        `[evaluate] Social constraint applies → wallet-only: reason=${socialResult.reason}`,
      );
      return {
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: socialResult.reason || 'Social currency constraint (self/teammate) requires wallet-only',
      };
    }

    // Otherwise → use Factor 3: Context Currency Mode
    const contextResult = await this.contextCurrencyModeFactor.evaluate(context);
    this.logger.debug(
      `[evaluate] Context currency mode applied: allowedQuota=${contextResult.allowedQuota}, allowedWallet=${contextResult.allowedWallet}`,
    );
    return contextResult;
  }
}
