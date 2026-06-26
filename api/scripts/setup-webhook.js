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
 *   DOMAIN        - Your application domain (e.g., meriter.pro); site URL is https://<DOMAIN>
 * 
 * You can load these from your .env file:
 *   export $(grep -E 'BOT_TOKEN|BOT_USERNAME|DOMAIN' .env | xargs)
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

function makePostRequest(url, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const payload = JSON.stringify(body);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const req = protocol.request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: `${parsedUrl.pathname}${parsedUrl.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            },
        );

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

const BOT_COMMANDS = [
    { command: 'balance', description: 'Ваш баланс и квота' },
    { command: 'members', description: 'Рейтинг участников' },
    { command: 'transfer', description: 'Перевод заслуг' },
    { command: 'help', description: 'Справка по командам' },
];

async function setBotCommands(botToken) {
    console.log('📋 Registering bot commands (English)...\n');
    const apiBase = `https://api.telegram.org/bot${botToken}/setMyCommands`;
    const scopes = [
        { type: 'default' },
        { type: 'all_group_chats' },
        { type: 'all_private_chats' },
    ];

    for (const scope of scopes) {
        const response = await makePostRequest(apiBase, { commands: BOT_COMMANDS, scope });
        if (!response.ok) {
            throw new Error(response.description || `setMyCommands failed for scope ${scope.type}`);
        }
        console.log(`   ✅ scope: ${scope.type}`);
    }
    console.log('');
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
            if (Array.isArray(info.allowed_updates)) {
                console.log(`   Allowed updates: ${info.allowed_updates.join(', ')}`);
                const required = ['message_reaction', 'message_reaction_count'];
                for (const key of required) {
                    if (!info.allowed_updates.includes(key)) {
                        console.log(`   ⚠️  Missing ${key} — reactions will not work; run: node scripts/setup-webhook.js set`);
                    }
                }
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
    
    const allowedUpdates = [
        'message',
        'my_chat_member',
        'chat_member',
        'callback_query',
        'message_reaction',
        'message_reaction_count',
    ].join(',');
    const url =
        `https://api.telegram.org/bot${botToken}/setWebhook` +
        `?url=${encodeURIComponent(webhookUrl)}` +
        `&allowed_updates=${encodeURIComponent(allowedUpdates)}`;
    
    try {
        const response = await makeRequest(url);
        
        if (!response.ok) {
            throw new Error(response.description || 'Unknown error');
        }
        
        console.log('✅ Webhook successfully configured!\n');

        await setBotCommands(botToken);
        
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
    const domain = process.env.DOMAIN;
    const appUrl = domain
        ? (domain === 'localhost' ? 'http://localhost' : `https://${domain}`)
        : undefined;

    if (!botToken) {
        console.error('❌ ERROR: BOT_TOKEN environment variable must be set');
        console.error('');
        console.error('Load it from your .env file:');
        console.error('  export $(grep -E "BOT_TOKEN|BOT_USERNAME|DOMAIN" .env | xargs)');
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
        if (!botUsername || !domain || !appUrl) {
            console.error('❌ ERROR: BOT_USERNAME and DOMAIN must be set for webhook configuration');
            console.error('');
            console.error('Example:');
            console.error('  export BOT_USERNAME=meriterbot');
            console.error('  export DOMAIN=meriter.pro');
            process.exit(1);
        }

        if (!appUrl.startsWith('https://')) {
            console.error('❌ ERROR: DOMAIN must not be localhost for Telegram (HTTPS required)');
            console.error(`   Current: ${appUrl}`);
            console.error('   Use DOMAIN=your-domain.com (e.g. meriter.pro)');
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

