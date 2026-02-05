import { router } from './trpc';
import { usersRouter } from './routers/users.router';
import { communitiesRouter } from './routers/communities.router';
import { authRouter } from './routers/auth.router';
import { configRouter } from './routers/config.router';
import { publicationsRouter } from './routers/publications.router';
import { commentsRouter } from './routers/comments.router';
import { votesRouter } from './routers/votes.router';
import { pollsRouter } from './routers/polls.router';
import { walletsRouter } from './routers/wallets.router';
import { notificationsRouter } from './routers/notifications.router';
import { searchRouter } from './routers/search.router';
import { uploadsRouter } from './routers/uploads.router';
import { favoritesRouter } from './routers/favorites.router';
import { categoriesRouter } from './routers/categories.router';
import { aboutRouter } from './routers/about.router';
import { tappalkaRouter } from './routers/tappalka.router';
import { teamsRouter } from './routers/teams.router';

/**
 * Main tRPC router combining all sub-routers
 * Export AppRouter type for frontend type inference
 */
export const appRouter = router({
  users: usersRouter,
  communities: communitiesRouter,
  auth: authRouter,
  config: configRouter,
  publications: publicationsRouter,
  comments: commentsRouter,
  votes: votesRouter,
  polls: pollsRouter,
  wallets: walletsRouter,
  notifications: notificationsRouter,
  search: searchRouter,
  uploads: uploadsRouter,
  favorites: favoritesRouter,
  categories: categoriesRouter,
  about: aboutRouter,
  tappalka: tappalkaRouter,
  teams: teamsRouter,
});

export type AppRouter = typeof appRouter;

