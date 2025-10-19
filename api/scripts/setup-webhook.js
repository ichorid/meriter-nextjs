#!/usr/bin/env node

/**
 * Configure Telegram Bot Webhook
 * 
 * Usage:
 *   node scripts/setup-webhook.js [check|set|delete]
 * 
 * Commands:
 *   check   - Check current webhook configuration (default)
 *   set     - Set webhook to the configured URL
 *   delete  - Remove webhook (switch to long polling)
 * 
 * Examples:
 *   node scripts/setup-webhook.js check
 *   node scripts/setup-webhook.js set
 *   node scripts/setup-webhook.js delete
 * 
 * Environment Variables Required:
 *   BOT_TOKEN     - Your Telegram bot token from @BotFather
 *   BOT_USERNAME  - Your bot username (without @)
 *   APP_URL       - Your application URL (e.g., https://meriter.ru)
 * 
 * You can load these from your .env file:
 *   export $(grep -E 'BOT_TOKEN|BOT_USERNAME|APP_URL' .env | xargs)
 *   node scripts/setup-webhook.js set
 */

const https = require('https');
const http = require('http');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function checkWebhook(botToken) {
    console.log('🔍 Checking webhook status...\n');
    
    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    
    try {
        const response = await makeRequest(url);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        const info = response.result;
        
        if (info.url) {
            console.log('✅ Webhook is configured:');
            console.log(`   URL: ${info.url}`);
            console.log(`   Pending updates: ${info.pending_update_count || 0}`);
            console.log(`   Max connections: ${info.max_connections || 40}`);
            if (info.last_error_date) {
                const lastErrorDate = new Date(info.last_error_date * 1000);
                console.log(`   ⚠️  Last error: ${info.last_error_message || 'Unknown'}`);
                console.log(`      Date: ${lastErrorDate.toISOString()}`);
            }
        } else {
            console.log('ℹ️  No webhook configured (using long polling mode)');
        }
        
        return info;
    } catch (error) {
        console.error('❌ Error checking webhook:', error.message);
        process.exit(1);
    }
}

async function setWebhook(botToken, botUsername, appUrl) {
    const webhookUrl = `${appUrl}/api/telegram/hooks/${botUsername}`;
    
    console.log('🔧 Setting webhook...');
    console.log(`   URL: ${webhookUrl}\n`);
    
    const url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    
    try {
        const response = await makeRequest(url);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        console.log('✅ Webhook successfully configured!\n');
        
        // Verify the configuration
        await checkWebhook(botToken);
        
        console.log('\n📝 Notes:');
        console.log('  - Telegram will now send updates to your server');
        console.log('  - Make sure your server is publicly accessible via HTTPS');
        console.log('  - The webhook URL must respond with 200 OK');
        console.log('\n🚀 Next steps:');
        console.log('  1. Ensure your application is running');
        console.log('  2. Test by sending a message to your bot');
        console.log('  3. Check application logs for incoming updates');
        
    } catch (error) {
        console.error('❌ Error setting webhook:', error.message);
        console.error('\nCommon issues:');
        console.error('  - URL must use HTTPS (not HTTP)');
        console.error('  - Invalid bot token');
        console.error('  - URL not publicly accessible');
        console.error('  - URL returns non-200 status code');
        process.exit(1);
    }
}

async function deleteWebhook(botToken) {
    console.log('🗑️  Deleting webhook...\n');
    
    const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
    
    try {
        const response = await makeRequest(url);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        console.log('✅ Webhook deleted successfully!');
        console.log('ℹ️  Bot is now in long polling mode\n');
        
    } catch (error) {
        console.error('❌ Error deleting webhook:', error.message);
        process.exit(1);
    }
}

async function main() {
    const command = process.argv[2] || 'check';
    
    if (!['check', 'set', 'delete'].includes(command)) {
        console.error('❌ Invalid command. Use: check, set, or delete');
        console.error('');
        console.error('Usage: node scripts/setup-webhook.js [check|set|delete]');
        process.exit(1);
    }
    
    const botToken = process.env.BOT_TOKEN;
    const botUsername = process.env.BOT_USERNAME;
    const appUrl = process.env.APP_URL;
    
    if (!botToken) {
        console.error('❌ ERROR: BOT_TOKEN environment variable must be set');
        console.error('');
        console.error('Load it from your .env file:');
        console.error('  export $(grep -E "BOT_TOKEN|BOT_USERNAME|APP_URL" .env | xargs)');
        console.error('');
        console.error('Or set it manually:');
        console.error('  export BOT_TOKEN=your_bot_token');
        process.exit(1);
    }
    
    console.log('🤖 Telegram Bot Webhook Configuration');
    console.log('═'.repeat(50));
    console.log('');
    
    if (command === 'check') {
        await checkWebhook(botToken);
    } else if (command === 'set') {
        if (!botUsername || !appUrl) {
            console.error('❌ ERROR: BOT_USERNAME and APP_URL must be set for webhook configuration');
            console.error('');
            console.error('Example:');
            console.error('  export BOT_USERNAME=meriterbot');
            console.error('  export APP_URL=https://meriter.ru');
            process.exit(1);
        }
        
        if (!appUrl.startsWith('https://')) {
            console.error('❌ ERROR: APP_URL must use HTTPS (Telegram requirement)');
            console.error(`   Current: ${appUrl}`);
            console.error('   Expected: https://your-domain.com');
            process.exit(1);
        }
        
        await setWebhook(botToken, botUsername, appUrl);
    } else if (command === 'delete') {
        await deleteWebhook(botToken);
    }
}

// Run the script
main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});

