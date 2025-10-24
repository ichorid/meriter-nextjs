# Meriter Web Frontend

A modern, type-safe React/Next.js frontend for the Meriter platform, built with best practices and modern development tools.

## 🚀 Features

- **TypeScript First**: Full type safety with strict mode enabled
- **Modern React**: Built with React 18 and Next.js 15
- **State Management**: React Query (TanStack Query) for server state
- **Authentication**: Centralized auth system with Telegram integration
- **UI Components**: DaisyUI + Telegram UI for consistent design
- **Internationalization**: Multi-language support with next-intl
- **Testing**: Comprehensive test suite with Jest and React Testing Library
- **Performance**: Optimized for speed and user experience

## 🏗️ Architecture

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Reusable UI components
│   ├── atoms/             # Basic building blocks
│   ├── molecules/         # Simple component combinations
│   ├── organisms/         # Complex component combinations
│   └── templates/         # Page layouts
├── contexts/              # React contexts (Auth, Theme, etc.)
├── features/              # Feature-specific modules
│   ├── auth/              # Authentication logic
│   ├── comments/          # Comment system
│   ├── communities/       # Community management
│   ├── feed/              # Content feed
│   ├── polls/             # Polling system
│   └── wallet/            # Wallet functionality
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── api/               # API client and endpoints
│   └── utils/             # Helper functions
├── shared/                # Shared components and utilities
├── types/                 # TypeScript type definitions
└── __tests__/             # Test files
```

### Key Architectural Principles

1. **Separation of Concerns**: Clear boundaries between features
2. **Dependency Inversion**: Features depend on abstractions, not implementations
3. **Single Responsibility**: Each module has one clear purpose
4. **DRY Principle**: No code duplication
5. **Type Safety**: Full TypeScript coverage

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd meriter-nextjs/web
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
# Edit .env.local with your configuration
```

4. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:8001`.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_BOT_USERNAME` | Telegram bot username | Yes |
| `NEXT_PUBLIC_BOT_TOKEN` | Telegram bot token | Yes |
| `NEXT_PUBLIC_BOT_URL` | Telegram bot URL | Yes |
| `NEXT_PUBLIC_APP_URL` | Application URL | Yes |
| `NEXT_PUBLIC_S3_BUCKET` | S3 bucket name | Yes |
| `NEXT_PUBLIC_S3_REGION` | S3 region | Yes |
| `NEXT_PUBLIC_S3_ACCESS_KEY_ID` | S3 access key | Yes |
| `NEXT_PUBLIC_S3_SECRET_ACCESS_KEY` | S3 secret key | Yes |

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Test Structure

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user flows

## 🚀 Building and Deployment

### Production Build

```bash
pnpm build
```

### Start Production Server

```bash
pnpm start
```

### Docker Deployment

```bash
docker build -t meriter-web .
docker run -p 8001:8001 meriter-web
```

## 📚 Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Write self-documenting code

### Component Development

- Use functional components with hooks
- Implement proper error boundaries
- Follow atomic design principles
- Write comprehensive tests

### API Integration

- Use the centralized API client
- Implement proper error handling
- Use React Query for data fetching
- Cache data appropriately

### Authentication

- Use the centralized auth context
- Protect routes with AuthGuard
- Handle authentication errors gracefully
- Clear sensitive data on logout

## 🔧 Configuration

### TypeScript Configuration

The project uses strict TypeScript configuration with:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`

### Next.js Configuration

- App Router enabled
- Server components support
- Experimental features configured
- Internationalization support

### Tailwind CSS

- DaisyUI components
- Custom theme configuration
- Responsive design utilities
- Dark mode support

## 📖 API Documentation

### Authentication Endpoints

- `POST /api/rest/telegram-auth` - Telegram widget authentication
- `POST /api/rest/telegram-auth/webapp` - Telegram Web App authentication
- `POST /api/rest/logout` - User logout
- `GET /api/rest/getme` - Get current user

### Data Endpoints

- `GET /api/rest/publications` - Get publications
- `POST /api/rest/publications` - Create publication
- `GET /api/rest/comments` - Get comments
- `POST /api/rest/comments` - Create comment
- `GET /api/rest/communities` - Get communities
- `GET /api/rest/wallets` - Get wallets

## 🐛 Troubleshooting

### Common Issues

1. **Module Resolution Errors**: Check Jest configuration and path mappings
2. **Authentication Issues**: Verify Telegram bot configuration
3. **Build Errors**: Check TypeScript errors and dependencies
4. **Test Failures**: Ensure all mocks are properly configured

### Debug Mode

Enable debug mode for detailed logging:

```bash
NEXT_PUBLIC_ENABLE_DEBUG=true pnpm dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Commit Convention

Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process or auxiliary tool changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- React Query team for excellent state management
- DaisyUI team for beautiful components
- Telegram team for Web App SDK
- All contributors and maintainers
