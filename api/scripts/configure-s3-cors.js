#!/usr/bin/env node

/**
 * Configure CORS on S3-compatible bucket (Mail.ru Cloud, AWS S3, MinIO, etc.)
 * 
 * Usage:
 *   node scripts/configure-s3-cors.js <bucket-name> <domain>
 * 
 * Examples:
 *   node scripts/configure-s3-cors.js telegram meriter.pro
 *   node scripts/configure-s3-cors.js my-avatars example.com
 * 
 * Environment Variables Required:
 *   S3_ACCESS_KEY_ID      - Your S3 access key
 *   S3_SECRET_ACCESS_KEY  - Your S3 secret key
 *   S3_ENDPOINT           - S3 endpoint URL (default: https://hb.bizmrg.com)
 *   S3_REGION             - S3 region (default: ru-msk)
 * 
 * You can load these from your .env file:
 *   export $(grep -E 'S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_ENDPOINT' .env | xargs)
 *   node scripts/configure-s3-cors.js telegram meriter.pro
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

async function configureCORS() {
    const bucketName = process.argv[2];
    const domain = process.argv[3];

    if (!bucketName || !domain) {
        console.error('❌ Usage: node scripts/configure-s3-cors.js <bucket-name> <domain>');
        console.error('');
        console.error('Example:');
        console.error('  node scripts/configure-s3-cors.js telegram meriter.pro');
        console.error('');
        console.error('Make sure S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are set!');
        process.exit(1);
    }

    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
        console.error('❌ ERROR: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables must be set');
        console.error('');
        console.error('Load them from your .env file:');
        console.error('  export $(grep -E "S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_ENDPOINT" .env | xargs)');
        console.error('');
        console.error('Or set them manually:');
        console.error('  export S3_ACCESS_KEY_ID=your_key');
        console.error('  export S3_SECRET_ACCESS_KEY=your_secret');
        process.exit(1);
    }

    const endpoint = process.env.S3_ENDPOINT || 'https://hb.bizmrg.com';
    const region = process.env.S3_REGION || 'ru-msk';

    console.log('📦 S3 Configuration:');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Region:   ${region}`);
    console.log(`   Bucket:   ${bucketName}`);
    console.log('');

    const s3Client = new S3Client({
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
        endpoint,
        region,
    });

    const corsConfiguration = {
        CORSRules: [
            {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedOrigins: [
                    `https://${domain}`,
                    `https://www.${domain}`,
                    'http://localhost:3000', // Development frontend
                    'http://localhost:8002', // Development API
                ],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
            },
        ],
    };

    console.log('🔧 Configuring CORS...');
    console.log('   Allowed origins:');
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
        console.log(`     - ${origin}`);
    });
    console.log('');

    try {
        // Try to get existing CORS configuration
        try {
            const existingCors = await s3Client.send(
                new GetBucketCorsCommand({ Bucket: bucketName })
            );
            console.log('📋 Existing CORS configuration:');
            console.log(JSON.stringify(existingCors.CORSRules, null, 2));
            console.log('');
        } catch (err) {
            if (err.name === 'NoSuchCORSConfiguration') {
                console.log('ℹ️  No existing CORS configuration found.');
            } else {
                console.log('⚠️  Could not retrieve existing CORS:', err.message);
            }
            console.log('');
        }

        // Apply new CORS configuration
        await s3Client.send(
            new PutBucketCorsCommand({
                Bucket: bucketName,
                CORSConfiguration: corsConfiguration,
            })
        );

        console.log('✅ CORS configuration successfully applied!');
        console.log('');
        console.log('Your bucket now allows cross-origin requests from:');
        corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
            console.log(`  ✓ ${origin}`);
        });
        console.log('');
        console.log('📝 Notes:');
        console.log('  - Direct S3 access from these domains will now work');
        console.log('  - No OpaqueResponseBlocking or CORS errors');
        console.log('  - Images load directly without proxy overhead');
        console.log('');
        console.log('🚀 Next steps:');
        console.log('  1. Restart your application server');
        console.log('  2. Clear browser cache if needed');
        console.log('  3. Test image loading from the allowed domains');

    } catch (error) {
        console.error('❌ Error configuring CORS:', error.message);
        console.error('');
        console.error('Common issues:');
        console.error('  - Wrong bucket name (check it exists)');
        console.error('  - Invalid credentials (verify S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY)');
        console.error('  - Insufficient permissions (need PutBucketCors permission)');
        console.error('  - Wrong endpoint (verify S3_ENDPOINT for your provider)');
        console.error('');
        if (error.Code) {
            console.error('Error code:', error.Code);
        }
        if (error.$metadata) {
            console.error('HTTP Status:', error.$metadata.httpStatusCode);
        }
        process.exit(1);
    }
}

// Run the configuration
configureCORS().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});

