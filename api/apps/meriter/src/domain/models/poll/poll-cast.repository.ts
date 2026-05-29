/**
 * @deprecated Import PollCastPersistenceAdapter from infrastructure/persistence.
 * Re-export retained for domain.module wiring during Tier-3 migration.
 */
export {
  PollCastPersistenceAdapter as PollCastRepository,
} from '../../../infrastructure/persistence/poll-cast.persistence.adapter';
