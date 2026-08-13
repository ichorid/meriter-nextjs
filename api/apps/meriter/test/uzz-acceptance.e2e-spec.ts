/**
 * Production acceptance gate for UZZ scenarios A-X.
 *
 * The scenarios live beside their responsible use cases so failures remain
 * locally diagnosable. Importing the suites here provides one reproducible
 * command that executes every named acceptance scenario against the real
 * domain and Mongo transaction adapters.
 */
import './uzz-domain.spec';
import './uzz-persistence.spec';
import './uzz-identity-security.spec';
import './uzz-listings-access.spec';
import './uzz-wallet-transactions.spec';
import './uzz-deal-use-cases.spec';
import './uzz-time-policies.spec';
import './uzz-thanks.spec';
import './uzz-outbox.spec';
import './uzz-emission.spec';
