[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ichorid/meriter-nextjs)


# Meriter

A merit-based community platform that integrates with Telegram to create engaging, gamified communities where members earn and distribute points through voting and contributions.

## 🌟 Key Features

- **📱 Telegram Integration**: Seamless authentication and Web App support
- **🌍 Internationalization**: Full English/Russian support with browser detection
- **🎯 Beneficiary Posts**: Route voting points to other community members
- **📊 Poll System**: Create and vote on community polls
- **💰 Merit Economy**: Earn and distribute points through community participation
- **🏘️ Community Management**: Organize multiple communities with different rules
- **💳 Wallet System**: Track balances and withdraw earned points

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### Local Development

1. **Clone and install dependencies (pnpm workspaces)**:
   ```bash
   git clone https://github.com/your-username/meriter-nextjs.git
   cd meriter-nextjs

   # Install all workspace dependencies
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your values (DOMAIN, APP_URL, etc.)

   # Backend env
   cp api/env.example api/.env

   # Frontend env
   cp web/env.example web/.env
   ```

3. **Start services**:
   ```bash
   # Terminal 1: Backend (NestJS)
   pnpm --filter @meriter/api dev
   
   # Terminal 2: Frontend (Next.js)
   pnpm --filter @meriter/web dev
   
   # Terminal 3: Caddy (reverse proxy)
   DOMAIN=localhost caddy run --config Caddyfile
   ```

4. **Access the application**:
   - Open http://localhost:8080
   - Login with Telegram
   - Start creating communities and posts!

### Production Deployment

See [README.deployment.md](README.deployment.md) for detailed Docker deployment instructions.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│     Caddy       │    │   Telegram      │
│  (Reverse Proxy)│◄──►│   Bot/Web App   │
└─────────────────┘    └─────────────────┘
            │
        ┌───┴───────────────┐
        │                   │
┌───────▼──────┐    ┌───────▼──────┐
│   Next.js    │    │   NestJS     │    ┌─────────────────┐
│   Frontend   │    │   Backend    │    │   MongoDB       │
│   (Port 8001)│    │  (Port 8002) │◄──►│   Database      │
└──────────────┘    └──────────────┘    └─────────────────┘
```

## 📚 Documentation

- **[Development Guide](DEVELOPMENT.md)** - Local development setup
- **[Deployment Guide](README.deployment.md)** - Production deployment
- **[Telegram Integration](web/TELEGRAM_WEBAPP.md)** - Telegram Web App setup
- **[API Scripts](api/scripts/README.md)** - Utility scripts
  
> Note: See `api/apps/meriter/test/` for backend tests and docs.

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS + DaisyUI** - Styling
- **react-i18next** - Internationalization
- **TanStack Query (React Query)** - Data fetching and caching

### Backend
- **NestJS** - Node.js framework
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **Telegram Bot API** - Bot integration

### Infrastructure
- **Docker** - Containerization
- **Caddy** - Reverse proxy with automatic HTTPS

## 🌐 Internationalization

Meriter supports English and Russian with automatic browser detection:

- **Auto Mode**: Detects browser language (default)
- **Manual Selection**: Choose English or Russian
- **Instant Switching**: No page reload required
- **Persistent Settings**: Saves preference across sessions

## 🤖 Telegram Integration

### Web App Mode
- Automatic authentication when opened from Telegram
- Theme synchronization with Telegram
- Haptic feedback for interactions
- Native Telegram UI elements

### Bot Features
- Community management
- Post creation with hashtags
- Beneficiary point routing (`/ben:@username`)
- Poll creation and voting

## 💡 Key Concepts

### Merit System
- **Points**: Earned through community voting
- **Communities**: Separate point economies
- **Voting**: Upvote/downvote posts and comments
- **Withdrawal**: Convert points to community currency

### Beneficiary Posts
Create posts that route voting points to other members:
```
Great contribution from our team! #community /ben:@username
```
- Points from votes go to `@username` instead of the author
- Useful for recognizing others' contributions
- Maintains community engagement

## 📄 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For questions or issues:
- Check the documentation above
- Review existing issues
- Create a new issue with detailed information

---

**Meriter** - Building merit-based communities through Telegram integration.
