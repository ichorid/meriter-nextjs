/**
 * Thin tRPC adapter: publication procedures live in the application layer.
 */
export {
  publicationsRouter,
  autoWithdrawPublicationBalanceBeforeDelete,
} from '../../adapters/trpc/handlers/publications-procedures.handler';
