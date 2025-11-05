#!/usr/bin/env node

/**
 * Configure Telegram Bot Menu Button and Settings
 * 
 * This script helps configure various Telegram bot settings:
 * - Menu button (opens web app)
 * - Bot description
 * - Commands
 * 
 * Usage:
 *   node scripts/setup-bot-menu.js [check|set|remove]
 * 
 * Commands:
 *   check   - Check current bot settings (default)
 *   set     - Set/update bot menu button URL
 *   remove  - Remove menu button (revert to default)
 * 
 * Examples:
 *   node scripts/setup-bot-menu.js check
 *   node scripts/setup-bot-menu.js set
 *   node scripts/setup-bot-menu.js remove
 * 
 * Environment Variables Required:
 *   BOT_TOKEN     - Your Telegram bot token from @BotFather
 *   APP_URL       - Your application URL (e.g., https://meriter.pro)
 * 
 * You can load these from your .env file:
 *   export $(grep -E 'BOT_TOKEN|APP_URL' .env | xargs)
 *   node scripts/setup-bot-menu.js set
 */

const https = require('https');
const http = require('http');

function makeRequest(url, method = 'GET', postData = null) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const options = {
            method,
            headers: postData ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            } : {}
        };
        
        const req = protocol.request(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ ok: false, description: `Failed to parse response: ${e.message}` });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (postData) {
            req.write(postData);
        }
        
        req.end();
    });
}

async function checkMenuButton(botToken) {
    console.log('🔍 Checking bot menu button configuration...\n');
    
    const url = `https://api.telegram.org/bot${botToken}/getChatMenuButton`;
    
    try {
        const response = await makeRequest(url);
        
        if (!response.ok) {
            console.error('❌ Error:', response.description);
            return null;
        }
        
        const button = response.result;
        
        if (button.type === 'web_app') {
            console.log('✅ Web App menu button is configured:');
            console.log(`   Text: ${button.text}`);
            console.log(`   URL:  ${button.web_app.url}`);
        } else if (button.type === 'default') {
            console.log('ℹ️  Default menu button (no custom configuration)');
        } else {
            console.log('ℹ️  Custom menu button type:', button.type);
            console.log(`   Text: ${button.text}`);
        }
        
        return button;
    } catch (error) {
        console.error('❌ Error checking menu button:', error.message);
        process.exit(1);
    }
}

async function setMenuButton(botToken, appUrl, path = '/miniapplogin') {
    const menuButtonUrl = `${appUrl}${path}`;
    
    console.log('🔧 Setting menu button...');
    console.log(`   URL: ${menuButtonUrl}\n`);
    
    const url = `https://api.telegram.org/bot${botToken}/setChatMenuButton`;
    const postData = JSON.stringify({
        menu_button: {
            type: 'web_app',
            text: 'Open App',
            web_app: {
                url: menuButtonUrl
            }
        }
    });
    
    try {
        const response = await makeRequest(url, 'POST', postData);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        console.log('✅ Menu button successfully configured!\n');
        
        // Verify the configuration
        await checkMenuButton(botToken);
        
        console.log('\n📝 Notes:');
        console.log('  - Users can now open your app from the bot menu');
        console.log('  - Menu button will appear in direct messages with the bot');
        console.log('  - URL must be accessible and valid Web App URL');
        
    } catch (error) {
        console.error('❌ Error setting menu button:', error.message);
        console.error('\nCommon issues:');
        console.error('  - Invalid bot token');
        console.error('  - URL format incorrect');
        console.error('  - Bot doesn\'t have sufficient permissions');
        process.exit(1);
    }
}

async function removeMenuButton(botToken) {
    console.log('🗑️  Removing menu button...\n');
    
    const url = `https://api.telegram.org/bot${botToken}/setChatMenuButton`;
    const postData = JSON.stringify({
        menu_button: {
            type: 'default'
        }
    });
    
    try {
        const response = await makeRequest(url, 'POST', postData);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        console.log('✅ Menu button removed successfully!');
        console.log('ℹ️  Bot is now using default menu button\n');
        
    } catch (error) {
        console.error('❌ Error removing menu button:', error.message);
        process.exit(1);
    }
}

async function main() {
    const command = process.argv[2] || 'check';
    const pathArg = process.argv[3];
    
    if (!['check', 'set', 'remove'].includes(command)) {
        console.error('❌ Invalid command. Use: check, set, or remove');
        console.error('');
        console.error('Usage: node scripts/setup-bot-menu.js [check|set|remove] [path]');
        console.error('');
        console.error('Examples:');
        console.error('  node scripts/setup-bot-menu.js check');
        console.error('  node scripts/setup-bot-menu.js set');
        console.error('  node scripts/setup-bot-menu.js set /meriter/login');
        console.error('  node scripts/setup-bot-menu.js remove');
        process.exit(1);
    }
    
    const botToken = process.env.BOT_TOKEN;
    const appUrl = process.env.APP_URL;
    
    if (!botToken) {
        console.error('❌ ERROR: BOT_TOKEN environment variable must be set');
        console.error('');
        console.error('Load it from your .env file:');
        console.error('  export $(grep -E "BOT_TOKEN|APP_URL" .env | xargs)');
        console.error('');
        console.error('Or set it manually:');
        console.error('  export BOT_TOKEN=your_bot_token');
        process.exit(1);
    }
    
    console.log('🤖 Telegram Bot Menu Button Configuration');
    console.log('═'.repeat(50));
    console.log('');
    
    if (command === 'check') {
        await checkMenuButton(botToken);
    } else if (command === 'set') {
        if (!appUrl) {
            console.error('❌ ERROR: APP_URL must be set for menu button configuration');
            console.error('');
            console.error('Example:');
            console.error('  export APP_URL=https://meriter.pro');
            process.exit(1);
        }
        
        if (!appUrl.startsWith('https://')) {
            console.error('❌ ERROR: APP_URL must use HTTPS (Telegram requirement)');
            console.error(`   Current: ${appUrl}`);
            console.error('   Expected: https://your-domain.com');
            process.exit(1);
        }
        
        const path = pathArg || '/miniapplogin';
        await setMenuButton(botToken, appUrl, path);
    } else if (command === 'remove') {
        await removeMenuButton(botToken);
    }
}

// Run the script
main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});

