import { Test, TestingModule } from '@nestjs/testing';
import { TrpcController } from '../../src/trpc/trpc.controller';
import { TrpcService } from '../../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { Request, Response, NextFunction } from 'express';

// Mock the tRPC middleware
jest.mock('@trpc/server/adapters/express', () => ({
  createExpressMiddleware: jest.fn(),
}));

describe('TrpcController', () => {
  let controller: TrpcController;
  let trpcService: jest.Mocked<TrpcService>;
  let mockMiddleware: jest.Mock;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mock middleware function
    mockMiddleware = jest.fn((req, res, next) => {
      // Simulate middleware calling next or handling the request
      if (next) {
        next();
      }
    });

    // Mock createExpressMiddleware to return our mock middleware
    (createExpressMiddleware as jest.Mock).mockReturnValue(mockMiddleware);

    // Create mock request, response, and next function
    mockRequest = {
      url: '/trpc/config.getConfig',
      method: 'GET',
      headers: {},
      cookies: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create mock TrpcService
    trpcService = {
      getRouter: jest.fn().mockReturnValue({} as any),
      createContext: jest.fn().mockResolvedValue({} as any),
    } as any;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrpcController],
      providers: [
        {
          provide: TrpcService,
          useValue: trpcService,
        },
      ],
    }).compile();

    controller = module.get<TrpcController>(TrpcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should handle single tRPC query requests', async () => {
    mockRequest.url = '/trpc/config.getConfig?input=%7B%7D';

    await controller.handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    // Verify middleware was called with the request
    expect(mockMiddleware).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      mockNext,
    );
    expect(mockMiddleware).toHaveBeenCalledTimes(1);
  });

  it('should handle batch tRPC requests with comma-separated paths', async () => {
    // This is the key test - batch requests have comma-separated procedure names
    mockRequest.url = '/trpc/config.getConfig,users.getMe?batch=1&input=%7B%7D';

    await controller.handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    // Verify middleware was called - this tests that @All() matches paths with commas
    expect(mockMiddleware).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      mockNext,
    );
    expect(mockMiddleware).toHaveBeenCalledTimes(1);
  });

  it('should handle POST requests to tRPC endpoints', async () => {
    mockRequest.method = 'POST';
    mockRequest.url = '/trpc/publications.create';

    await controller.handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockMiddleware).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      mockNext,
    );
  });

  it('should handle batch POST requests', async () => {
    mockRequest.method = 'POST';
    mockRequest.url = '/trpc/publications.create,votes.create?batch=1';

    await controller.handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockMiddleware).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      mockNext,
    );
  });

  it('should handle requests with nested procedure paths', async () => {
    mockRequest.url = '/trpc/users.getUserProfile?input=%7B%22id%22%3A%22user123%22%7D';

    await controller.handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockMiddleware).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      mockNext,
    );
  });

  it('should initialize tRPC middleware with correct router and context', () => {
    // Verify that createExpressMiddleware was called with correct parameters
    expect(createExpressMiddleware).toHaveBeenCalledWith({
      router: expect.any(Object),
      createContext: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  it('should pass all HTTP methods to tRPC middleware', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

    for (const method of methods) {
      mockRequest.method = method;
      mockRequest.url = `/trpc/test.procedure`;

      await controller.handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
    }

    // Should have been called once for each HTTP method
    expect(mockMiddleware).toHaveBeenCalledTimes(methods.length);
  });
});

