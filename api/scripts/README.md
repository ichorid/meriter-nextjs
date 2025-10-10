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

