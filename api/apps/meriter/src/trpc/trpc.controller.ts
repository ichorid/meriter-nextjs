import { Controller, All, Req, Res, Next } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

@Controller('trpc')
export class TrpcController {
  private trpcMiddleware: ReturnType<typeof createExpressMiddleware>;

  constructor(private readonly trpcService: TrpcService) {
    this.trpcMiddleware = createExpressMiddleware({
      router: this.trpcService.getRouter(),
      createContext: ({ req, res }) => this.trpcService.createContext(req, res),
      onError({ error, path }) {
        console.error(`tRPC error on '${path}':`, error);
      },
    });
  }

  @All(':path(*)')
  async handler(@Req() req: any, @Res() res: any, @Next() next: any) {
    return this.trpcMiddleware(req, res, next);
  }
}

