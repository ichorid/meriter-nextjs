# Meriter Features

This document provides detailed information about Meriter's key features and how to use them.

## 🌍 Internationalization (I18N)

Meriter supports English and Russian languages with automatic browser detection and user preference storage.

### How It Works

**Language Detection Priority:**
1. User's saved preference (if manually selected)
2. Browser language detection (if set to "Auto")
3. English fallback (for other languages)

**Language Options:**
- **Auto (Browser Default)** - Automatically detects your browser language
- **English** - Always use English
- **Русский** - Always use Russian

### Using Language Selector

1. Go to Settings (`/meriter/settings`)
2. Find "Interface Language" section
3. Select your preferred option
4. Language changes instantly without page reload

### For Developers

**Adding translations to components:**
```typescript
import { useTranslation } from 'react-i18next';

export const MyComponent = () => {
  const { t } = useTranslation('namespace');
  return <div>{t('keyName')}</div>;
}
```

**Translation files location:**
- `web/public/locales/en/` - English translations
- `web/public/locales/ru/` - Russian translations

**Namespaces:**
- `common` - Shared UI elements
- `home` - Home page
- `login` - Login page
- `settings` - Settings page
- `polls` - Poll components
- `feed` - Feed/publication components
- `comments` - Comment components
- `wallet` - Wallet components
- `communities` - Community components
- `shared` - Shared utilities

## 🎯 Beneficiary Posts

Create posts that route voting points to other community members instead of yourself.

### How to Use

**In Telegram groups with Meriter bot:**
1. Create a message with your community hashtag
2. Add `/ben:@username` or `/ben:123456` anywhere in the message
3. The `/ben:` command will be stripped from the displayed text
4. Points from votes will go to the beneficiary

**Example:**
```
This is a great contribution from our team member! #community /ben:@johndoe
```

**Result:**
- Post displays: "This is a great contribution from our team member! #community"
- Author shows as: "AuthorName для johndoe"
- All voting points go to `@johndoe` instead of the author

### Validation Rules

**Beneficiary Requirements:**
1. Must exist in Meriter database (previously registered)
2. Must be a member of the community chat
3. Must be accessible via username or Telegram ID

**Error Messages:**
- `⚠️ Пользователь @username не найден в Meriter.` - User not registered
- `⚠️ Пользователь @username не является участником этого сообщества.` - Not a community member
- `⚠️ Ошибка при обработке пользователя @username.` - Technical error

### Technical Implementation

**Backend Processing:**
- Parses `/ben:@username` or `/ben:123456` from message text
- Validates beneficiary exists and is community member
- Strips command from display text
- Routes points to beneficiary's Telegram ID

**Frontend Display:**
- Shows "Author для Beneficiary" format
- Maintains withdrawal functionality with original author
- Voting points go to beneficiary

## 📱 Telegram Integration

### Web App Mode

**Automatic Authentication:**
- Detects when opened in Telegram's internal browser
- Uses `initData` for secure authentication
- No login widget required
- Falls back to standard widget in regular browsers

**Theme Synchronization:**
- Automatically matches Telegram's light/dark theme
- Responds to theme changes in real-time
- Uses Telegram's color scheme

**Native Features:**
- Haptic feedback on voting actions
- Main Button for poll creation
- Back Button for navigation
- Progress indicators

### Bot Features

**Community Management:**
- Create and manage communities
- Set community rules and parameters
- Monitor member activity

**Post Creation:**
- Create posts with hashtags
- Support for beneficiary routing
- Rich text formatting
- Image attachments

**Poll System:**
- Create polls with multiple options
- Vote on polls with point allocation
- Track poll results and statistics

## 📊 Poll System

Create and participate in community polls with point-based voting.

### Creating Polls

**Via Web Interface:**
1. Go to community page
2. Click "Create Poll"
3. Enter poll question and options
4. Set voting parameters
5. Submit poll

**Poll Types:**
- Single choice
- Multiple choice
- Point allocation voting

### Voting on Polls

**Voting Options:**
- Use daily quota (free votes)
- Use personal balance (paid votes)
- Slider interface for amount selection

**Point Allocation:**
- Distribute points across poll options
- Track total points allocated
- See real-time results

## 💰 Merit Economy

### Point System

**Earning Points:**
- Receive votes on your posts
- Receive votes on your comments
- Community participation rewards

**Spending Points:**
- Vote on others' posts/comments
- Participate in polls
- Community-specific activities

**Point Types:**
- **Personal Balance**: Your earned points
- **Daily Quota**: Free daily voting allowance
- **Community Points**: Community-specific currency

### Wallet System

**Balance Tracking:**
- View personal balance
- Track community balances
- Transaction history

**Withdrawal:**
- Convert points to community currency
- Withdraw to external wallets (if configured)
- Transfer between communities

## 🏘️ Community Management

### Community Features

**Community Types:**
- Public communities (anyone can join)
- Private communities (invite-only)
- Space-based communities

**Community Settings:**
- Custom rules and parameters
- Point distribution settings
- Member management
- Content moderation

### Member Management

**Roles:**
- Regular members
- Moderators
- Administrators

**Permissions:**
- Post creation
- Voting rights
- Moderation capabilities
- Administrative functions

## 🔧 Technical Features

### Architecture

**Microservices Design:**
- Frontend: Next.js with App Router
- Backend: NestJS with modular structure
- Database: MongoDB with Mongoose
- Proxy: Caddy for routing and HTTPS

**Security:**
- JWT-based authentication
- Telegram Web App validation
- CORS protection
- Input validation

### Performance

**Optimizations:**
- Server-side rendering (SSR)
- Client-side hydration
- SWR for data fetching
- Image optimization
- Compression

**Scalability:**
- Docker containerization
- Horizontal scaling support
- Database indexing
- Caching strategies

## 🚀 Getting Started

### For Users

1. **Join a Community**: Find communities via Telegram or web interface
2. **Create Posts**: Share content with community hashtags
3. **Vote and Earn**: Participate in community voting
4. **Manage Wallet**: Track and withdraw earned points

### For Developers

1. **Setup Development**: Follow [DEVELOPMENT.md](DEVELOPMENT.md)
2. **Deploy Production**: See [README.deployment.md](README.deployment.md)
3. **Configure Bot**: Use [Telegram Integration Guide](web/TELEGRAM_WEBAPP.md)
4. **Run Tests**: Follow [Testing Guide](api/apps/meriter/test/TESTING_GUIDE.md)

## 📈 Future Enhancements

**Planned Features:**
- Additional languages (Spanish, Chinese, etc.)
- Advanced analytics and reporting
- Mobile app development
- Enhanced moderation tools
- Integration with external services

**Community Features:**
- Custom community themes
- Advanced voting mechanisms
- Reputation systems
- Achievement badges

---

For technical implementation details, see the respective documentation files in this repository.
