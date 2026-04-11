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

- Docker and Docker Compose (for easiest setup) **OR** Node.js 18+ with MongoDB
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### Local Development

**Quickest way (Docker Compose - Recommended):**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/meriter-nextjs.git
   cd meriter-nextjs
   ```

2. **Configure and start**:
   ```bash
   # Create .env from template
   cp env.example .env
   # Edit .env and add your BOT_TOKEN and BOT_USERNAME

   # Start all services with Docker Compose
   docker compose -f docker-compose.local.yml up -d --build
   ```

3. **Access the application**:
   - Open http://localhost:8001
   - Login with Telegram
   - Start creating communities and posts!

**Alternative: Manual setup with pnpm:**

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed instructions on running services manually.

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

## 🔬 Codegraph (Dependency Intelligence)

The project uses [codegraph](https://github.com/optave/ops-codegraph-tool) to provide a function-level dependency graph across the entire monorepo. AI agents and developers can query callers, callees, blast radius, and semantic search — without reading files manually.

**First-time setup:**

```bash
npm install -g @optave/codegraph   # requires Node >= 22.6
cd meriter-nextjs
codegraph build                    # ~6s full build, sub-second incremental
codegraph embed                    # semantic embeddings (~2 min, one-time)
codegraph co-change --analyze      # git co-change coupling (one-time)
```

**During development:**

```bash
codegraph watch                    # keep graph fresh in a terminal tab
codegraph where <name>             # find any symbol
codegraph context <name> -T        # full context in one call
codegraph fn-impact <name> -T      # blast radius before editing
codegraph diff-impact --staged -T  # verify impact before committing
codegraph search "handle auth"     # semantic search by intent
```

The graph is stored locally in `.codegraph/` (gitignored). A Cursor MCP server is configured in `.cursor/mcp.json` — Cursor agents can query the graph directly via MCP tools. See `.cursor/rules/codegraph.mdc` and `.cursor/skills/codegraph/` for agent integration details.

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
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
