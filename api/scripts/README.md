# Utility Scripts

## configure-s3-cors.js

Configure CORS (Cross-Origin Resource Sharing) on S3-compatible storage buckets.

### Purpose

This script fixes CORS-related errors when loading images/assets from S3 buckets in web browsers:
- **OpaqueResponseBlocking errors**
- **Access Denied errors** due to missing CORS headers
- Cross-origin request blocks

### When to Use

- Setting up a new environment (staging, production)
- Deploying to a new domain
- Switching S3 providers
- Adding additional allowed domains

### Prerequisites

1. S3 credentials with `PutBucketCors` permission
2. Access to your S3 bucket
3. Node.js installed

### Usage

```bash
# Navigate to api directory
cd api

# Load credentials from .env file
export $(grep -E 'S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_ENDPOINT' .env | xargs)

# Run the script
node scripts/configure-s3-cors.js <bucket-name> <domain>
```

### Examples

**Configure for production domain:**
```bash
node scripts/configure-s3-cors.js telegram meriter.pro
```

**Configure for staging environment:**
```bash
node scripts/configure-s3-cors.js telegram staging.meriter.pro
```

**Configure for different bucket:**
```bash
node scripts/configure-s3-cors.js profile-photos meriter.pro
```

### Environment Variables

The script requires these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_ACCESS_KEY_ID` | S3 access key | (required) |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | (required) |
| `S3_ENDPOINT` | S3 endpoint URL | `https://hb.bizmrg.com` |
| `S3_REGION` | S3 region | `ru-msk` |

### What It Does

The script configures CORS to allow:
- `https://{domain}` - Main domain
- `https://www.{domain}` - WWW subdomain
- `http://localhost:3000` - Development frontend
- `http://localhost:8002` - Development API

For HTTP methods:
- `GET` - Read files
- `HEAD` - Check file metadata

### Verification

After running the script, you can verify CORS is working:

1. Open your web application in a browser
2. Check the browser console - no CORS errors
3. Images from S3 should load without issues
4. Network tab should show successful requests with CORS headers

### Troubleshooting

**Error: Module not found**
```bash
# Make sure you're in the api directory
cd api
npm install  # or pnpm install
```

**Error: Invalid credentials**
```bash
# Check your .env file has correct S3 credentials
cat .env | grep S3_
```

**Error: Access Denied**
- Verify your S3 credentials have `PutBucketCors` permission
- Check the bucket name is correct
- Confirm you have access to the bucket

**CORS still not working after configuration**
- Clear browser cache
- Restart your application
- Check the domain name matches exactly (no typos)
- Verify S3_ENDPOINT matches your provider

### Additional Notes

- Configuration is permanent until changed
- Safe to run multiple times (overwrites previous config)
- Only affects the specified bucket
- Does not modify bucket contents or permissions

## setup-webhook.js

Configure webhook for Telegram bot to receive updates.

### Purpose

This script manages the webhook configuration for your Telegram bot:
- **Check** current webhook status and configuration
- **Set** webhook to your application URL
- **Delete** webhook (switch back to long polling)

### When to Use

- Initial deployment setup
- Changing domains or server URLs
- Debugging webhook issues
- Switching between webhook and polling modes

### Prerequisites

1. Telegram bot token from @BotFather
2. Bot username (without @)
3. Publicly accessible HTTPS URL
4. Application deployed and running

### Usage

```bash
# Navigate to api directory
cd api

# Load credentials from .env file
export $(grep -E 'BOT_TOKEN|BOT_USERNAME|APP_URL' .env | xargs)

# Check current webhook status
node scripts/setup-webhook.js check

# Set webhook to your application URL
node scripts/setup-webhook.js set

# Delete webhook (use long polling instead)
node scripts/setup-webhook.js delete
```

### Examples

**Check webhook status:**
```bash
node scripts/setup-webhook.js check
```

**Configure webhook for production:**
```bash
export BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
export BOT_USERNAME=meriterbot
export APP_URL=https://meriter.pro
node scripts/setup-webhook.js set
```

**Remove webhook:**
```bash
node scripts/setup-webhook.js delete
```

### Environment Variables

The script requires these environment variables:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `BOT_TOKEN` | Bot token from @BotFather | All commands |
| `BOT_USERNAME` | Bot username (without @) | set |
| `APP_URL` | Application URL (must be HTTPS) | set |

### What It Does

**check** command:
- Retrieves current webhook configuration
- Shows webhook URL (if configured)
- Displays pending update count
- Shows any recent errors

**set** command:
- Validates HTTPS requirement
- Constructs webhook URL: `{APP_URL}/api/telegram/hooks/{BOT_USERNAME}`
- Registers webhook with Telegram
- Verifies configuration

**delete** command:
- Removes webhook configuration
- Switches bot to long polling mode

### Verification

After setting the webhook:

1. Send a test message to your bot
2. Check application logs for webhook receipt
3. Look for log messages like: `🌐 Webhook received: bot=meriterbot`
4. Verify no errors in webhook info: `node scripts/setup-webhook.js check`

### Troubleshooting

**Error: URL must use HTTPS**
```bash
# Telegram requires HTTPS for webhooks
# Make sure APP_URL starts with https://
export APP_URL=https://meriter.pro  # ✓ Correct
export APP_URL=http://meriter.pro   # ✗ Wrong
```

**Error: BOT_TOKEN not set**
```bash
# Check your .env file has the bot token
cat .env | grep BOT_TOKEN

# Load it manually
export BOT_TOKEN=your_token_here
```

**Webhook shows last error**
- Check your server is running and accessible
- Verify the webhook endpoint returns 200 OK
- Check application logs for errors processing updates
- Ensure SSL certificate is valid

**No updates received**
- Verify webhook is set: `node scripts/setup-webhook.js check`
- Ensure your server is publicly accessible
- Check firewall allows incoming HTTPS connections
- Test webhook URL manually in browser

### Additional Notes

- Webhook registration persists until changed or deleted
- Only one webhook URL can be active per bot
- Safe to run `set` command multiple times
- Telegram retries failed webhook deliveries
- Use `check` command to debug webhook issues

## setup-bot-menu.js

Configure Telegram bot menu button to open the web app.

### Purpose

This script manages the bot's menu button configuration:
- **Check** current menu button settings
- **Set** menu button URL to open your web app
- **Remove** menu button (revert to default Telegram menu)

### When to Use

- Setting up initial bot menu button
- Changing web app URL or domain
- Troubleshooting bot menu not appearing
- Removing custom menu (switching to default)

### Prerequisites

1. Telegram bot token from @BotFather
2. Publicly accessible HTTPS URL
3. Web app deployed and running

### Usage

```bash
# Navigate to api directory
cd api

# Load credentials from .env file
export $(grep -E 'BOT_TOKEN|APP_URL' .env | xargs)

# Check current menu button configuration
node scripts/setup-bot-menu.js check

# Set menu button to open login page
node scripts/setup-bot-menu.js set

# Set menu button to custom path
node scripts/setup-bot-menu.js set /meriter/home

# Remove menu button
node scripts/setup-bot-menu.js remove
```

### Examples

**Check current menu button:**
```bash
node scripts/setup-bot-menu.js check
```

**Set menu button for production:**
```bash
export BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
export APP_URL=https://meriter.pro
node scripts/setup-bot-menu.js set
```

**Set custom path:**
```bash
node scripts/setup-bot-menu.js set /meriter/home
```

**Remove menu button:**
```bash
node scripts/setup-bot-menu.js remove
```

### Environment Variables

The script requires these environment variables:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `BOT_TOKEN` | Bot token from @BotFather | All commands |
| `APP_URL` | Application URL (must be HTTPS) | set |

### What It Does

**check** command:
- Retrieves current menu button configuration
- Shows button type (web_app, default, or custom)
- Displays button text and URL

**set** command:
- Creates a "Open App" menu button
- Sets web app URL (default: `/meriter/login`)
- Allows custom path specification
- Enables users to open your app from bot menu

**remove** command:
- Removes custom menu button
- Reverts to default Telegram menu
- Shows default command options

### Verification

After setting the menu button:

1. Open a chat with your bot in Telegram
2. Click on the bot's name at the top
3. Look for the "Open App" button in menu
4. Click button - should open your web app
5. Verify it navigates to the correct URL

### Troubleshooting

**Error: URL must use HTTPS**
```bash
# Telegram requires HTTPS for web apps
export APP_URL=https://meriter.pro  # ✓ Correct
export APP_URL=http://meriter.pro   # ✗ Wrong
```

**Error: Menu button not appearing**
- Bot must have chat history with the user
- User must click on bot's name to see menu
- Ensure web app URL is accessible and returns valid HTML
- Wait a few minutes for Telegram to propagate changes

**Error: Invalid bot token**
```bash
# Verify token is correct
echo $BOT_TOKEN

# Get new token from @BotFather if needed
# Send /mybots → Your Bot → API Token
```

**Menu button appears but doesn't open web app**
- Check URL is accessible: `curl https://your-domain.com/meriter/login`
- Verify URL returns HTML (not redirect)
- Check browser console for errors
- Ensure Telegram app is updated

### Additional Notes

- Menu button is visible in direct chats with the bot
- Changes take effect immediately (no propagation delay)
- Safe to run `set` command multiple times
- Custom path can be any valid relative path on your domain
- Users see "Open App" button text (cannot be customized)
- Menu button does not appear in group chats

