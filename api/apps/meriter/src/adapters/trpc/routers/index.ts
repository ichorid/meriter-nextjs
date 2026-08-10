/**
 * Adapter-layer re-exports for tRPC routers (Phase 7 transport consolidation).
 * Primary mount remains `trpc/router.ts`; import from here in new code when possible.
 */
export { publicationsRouter } from '../handlers/publications-procedures.handler';
export { communitiesRouter } from '../../../trpc/routers/communities.router';
export { votesRouter } from '../../../trpc/routers/votes.router';
export { walletsRouter } from '../../../trpc/routers/wallets.router';
export { usersRouter } from '../../../trpc/routers/users.router';
export { commentsRouter } from '../../../trpc/routers/comments.router';
export { authRouter } from '../../../trpc/routers/auth.router';
export { projectRouter } from '../../../trpc/routers/project.router';
export { ticketRouter } from '../../../trpc/routers/ticket.router';
