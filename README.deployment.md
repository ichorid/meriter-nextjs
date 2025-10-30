# Meriter Deployment Guide

## Overview

This document describes the Docker-based deployment setup for the Meriter application with automated CI/CD using GitHub Actions.

## Architecture

The application consists of three main services:

- **Web**: Next.js frontend application (port 8001)
- **API**: NestJS backend application (port 8002)
- **Caddy**: Reverse proxy with automatic HTTPS (ports 80/443)

All data is stored in an external MongoDB instance - no persistent volumes required for application data.

## CI/CD Pipeline

### CI/CD

If GitHub Actions workflows are configured in your fork, you may build and push container images automatically on pushes to `main`. If not, use the manual Docker Compose instructions below. Refer to your repository's Actions tab if present.

## Configuration

### Environment Variables

1. Copy the template file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and configure the following critical variables:

   **Database (API):**
   ```env
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/meriter
   ```

   **Security (API - change these!):**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   SESSION_SECRET=your-session-secret-change-this-in-production
   COOKIE_SECRET=your-cookie-secret-change-this-in-production
   ```

   **Domain (Caddy):**
   ```env
   DOMAIN=yourdomain.com
   ```

   **Telegram Bot (API - required):**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
   BOT_USERNAME=your_bot_username
   APP_URL=https://yourdomain.com
   ```

   **S3 Storage (API - optional):**
   ```env
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket
   ```

   **Frontend API URL (Web):**
   ```env
   NEXT_PUBLIC_API_URL=https://yourdomain.com
   NEXT_PUBLIC_BOT_USERNAME=your_bot_username
   ```

### Caddy Configuration

The `Caddyfile` (root of repo) configures:

- Automatic HTTPS with Let's Encrypt
- Reverse proxy to Next.js on port 8001
- Access logging
- Gzip compression

To use a custom domain, set the `DOMAIN` environment variable in `.env`:

```env
DOMAIN=yourdomain.com
```

For local development, use:

```env
DOMAIN=localhost
```

## Deployment Instructions

### Initial Setup on VPS

1. **Install Docker and Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt-get install docker-compose-plugin
   ```

2. **Clone the repository**
   ```bash
   git clone https://github.com/[owner]/meriter-nextjs.git
   cd meriter-nextjs
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   nano .env  # Edit with your values
   ```

4. **Build and start services**
   ```bash
   docker-compose up -d
   ```

5. **Verify deployment**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### S3 CORS Configuration (Required for Image Loading)

If you're using S3-compatible storage for avatar images, you need to configure CORS to avoid browser blocking errors:

1. **Set up environment variables**
   ```bash
   cd api
   # Make sure your .env file has S3 credentials:
   # S3_ACCESS_KEY_ID=your_key
   # S3_SECRET_ACCESS_KEY=your_secret
   # S3_ENDPOINT=https://hb.bizmrg.com
   ```

2. **Load credentials and run configuration script**
   ```bash
   export $(grep -E 'S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_ENDPOINT' .env | xargs)
   node scripts/configure-s3-cors.js telegram your-domain.com
   ```

3. **For multiple environments**
   ```bash
   # Production
   node scripts/configure-s3-cors.js telegram meriter.pro
   
   # Staging
   node scripts/configure-s3-cors.js telegram staging.meriter.pro
   ```

See `api/scripts/README.md` for detailed documentation on the CORS configuration utility.

**Note**: This only needs to be done once per environment/domain. The configuration persists on the S3 bucket.

### Updating to Latest Images (if using a registry)

When new images are built and pushed by GitHub Actions:

1. **Pull latest images**
   ```bash
   docker pull ghcr.io/[owner]/meriter-nextjs-web:latest
   docker pull ghcr.io/[owner]/meriter-nextjs-api:latest
   ```

2. **Update docker-compose to use registry images**
   
   Edit `docker-compose.yml` to replace `build:` sections with `image:`:

   ```yaml
   web:
     image: ghcr.io/[owner]/meriter-nextjs-web:latest
     # Remove the 'build:' section
     container_name: meriter-web
     # ... rest of config
   
   api:
     image: ghcr.io/[owner]/meriter-nextjs-api:latest
     # Remove the 'build:' section
     container_name: meriter-api
     # ... rest of config
   ```

3. **Restart services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Deploying Specific Version

To deploy a specific version instead of latest:

```bash
docker pull ghcr.io/[owner]/meriter-nextjs-web:v0.1.0
docker pull ghcr.io/[owner]/meriter-nextjs-api:v0.1.0
```

Update `docker-compose.yml` with the specific version tags.

### Authentication for Private Registry

If the repository is private, authenticate Docker with GitHub:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

Generate a GitHub Personal Access Token with `read:packages` scope.

## Version Management

### Updating Versions

1. Update version in `web/package.json`:
   ```json
   {
     "version": "0.2.0"
   }
   ```

2. Update version in `api/package.json`:
   ```json
   {
     "version": "0.2.0"
   }
   ```

3. Commit and push to main:
   ```bash
   git add web/package.json api/package.json
   git commit -m "Bump version to 0.2.0"
   git push origin main
   ```

4. GitHub Actions will automatically build and push images tagged with `v0.2.0`

### Semantic Versioning Best Practices

Follow semantic versioning (semver):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

## Monitoring and Logs

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f api
docker-compose logs -f caddy
```

### Check service health

```bash
docker-compose ps
```

### Inspect containers

```bash
docker inspect meriter-web
docker inspect meriter-api
docker inspect meriter-caddy
```

## Troubleshooting

### Services won't start

1. Check logs:
   ```bash
   docker-compose logs
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Check MongoDB connectivity:
   ```bash
   docker-compose exec api sh
   wget -O- $MONGODB_URI
   ```

### Images fail to pull

1. Verify authentication:
   ```bash
   docker login ghcr.io
   ```

2. Check image exists:
   ```bash
   docker manifest inspect ghcr.io/[owner]/meriter-nextjs-web:latest
   ```

### HTTPS not working

1. Ensure DNS points to your VPS
2. Check domain in `.env`:
   ```bash
   grep DOMAIN .env
   ```
3. View Caddy logs:
   ```bash
   docker-compose logs caddy
   ```

### Port conflicts

If ports 80, 443, 8001, or 8002 are in use:

```bash
sudo netstat -tulpn | grep -E ':(80|443|8001|8002)'
```

Stop conflicting services or change ports in `docker-compose.yml`.

## Rollback Procedure

To rollback to a previous version:

1. **Identify the previous version**
   ```bash
   # Check GitHub packages or git history
   git log --oneline web/package.json
   ```

2. **Pull the specific version**
   ```bash
   docker pull ghcr.io/[owner]/meriter-nextjs-web:v0.1.0
   docker pull ghcr.io/[owner]/meriter-nextjs-api:v0.1.0
   ```

3. **Update docker-compose.yml** with version tags

4. **Restart services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Security Considerations

- **Environment Variables**: Never commit `.env` file to git
- **Secrets**: Rotate JWT_SECRET, SESSION_SECRET regularly
- **MongoDB**: Use strong passwords and network security
- **Updates**: Keep base images updated (rebuild periodically)
- **Firewall**: Only expose ports 80 and 443 publicly

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NestJS Deployment](https://docs.nestjs.com/)

