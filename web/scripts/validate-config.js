#!/usr/bin/env node

/**
 * Configuration Validation Script
 * 
 * This script validates that all required environment variables are set
 * and that the configuration is valid for the current environment.
 */

// Simple configuration validation without importing the full config
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    url: process.env.APP_URL || 'https://meriter.pro',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002',
  },
  telegram: {
    botUsername: process.env.BOT_USERNAME || '',
    botToken: process.env.BOT_TOKEN || '',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT?.trim(),
    region: process.env.S3_REGION?.trim(),
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    get enabled() {
      return !!(this.endpoint && this.region && this.accessKeyId && this.secretAccessKey);
    },
  },
  features: {
    debug: process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true' || process.env.NODE_ENV === 'development',
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
};

console.log('🔍 Validating configuration...\n');

// Check required configuration
const errors = [];
const warnings = [];

// Check API configuration
if (!config.api.baseUrl) {
  errors.push('API base URL is not configured');
}

// Check Telegram configuration
// BOT_USERNAME is required - no fallback
if (!config.telegram.botUsername || config.telegram.botUsername.trim() === '') {
  errors.push('BOT_USERNAME is required but not configured');
}

if (!config.telegram.botToken) {
  warnings.push('Bot token is not configured - some features may not work');
}

// Check S3 configuration
const hasS3Endpoint = !!config.s3.endpoint;
const hasS3Region = !!config.s3.region;
const hasS3Credentials = !!config.s3.accessKeyId && !!config.s3.secretAccessKey;

if (hasS3Endpoint && !hasS3Region) {
  errors.push('S3_REGION must be configured when S3_ENDPOINT is set');
}

if (!hasS3Endpoint && hasS3Region) {
  errors.push('S3_REGION is set but S3_ENDPOINT is missing');
}

if (hasS3Endpoint && hasS3Region && !hasS3Credentials) {
  errors.push('S3_ENDPOINT is configured but credentials are missing');
}

// Check environment-specific configuration
if (config.app.isProduction) {
  if (config.api.baseUrl.includes('localhost')) {
    errors.push('Production environment should not use localhost API URL');
  }
  
  if (config.app.url.includes('localhost')) {
    errors.push('Production environment should not use localhost app URL');
  }
}

// Display results
if (errors.length > 0) {
  console.error('❌ Configuration errors:');
  errors.forEach(error => console.error(`  - ${error}`));
  console.error('');
}

if (warnings.length > 0) {
  console.warn('⚠️  Configuration warnings:');
  warnings.forEach(warning => console.warn(`  - ${warning}`));
  console.warn('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Configuration is valid!');
} else if (errors.length === 0) {
  console.log('✅ Configuration is valid with warnings.');
} else {
  console.error('❌ Configuration validation failed.');
  process.exit(1);
}

// Display current configuration
console.log('\n📋 Current configuration:');
console.log(`  Environment: ${config.app.env}`);
console.log(`  API URL: ${config.api.baseUrl}`);
console.log(`  Bot Username: ${config.telegram.botUsername}`);
console.log(`  S3 Endpoint: ${config.s3.endpoint || 'not configured'}`);
console.log(`  S3 Region: ${config.s3.region || 'not configured'}`);
console.log(`  S3 Enabled: ${config.s3.enabled}`);
console.log(`  Debug Mode: ${config.features.debug}`);
console.log(`  Analytics: ${config.features.analytics}`);
