# Security Hardening Documentation

This document describes the security measures implemented in the Meriter Next.js application.

## Overview

The application has been hardened with multiple layers of security:

1. **Container Security** - Non-root users, read-only filesystems, resource limits
2. **Network Security** - Isolated Docker networks, no unnecessary port exposure
3. **Database Security** - MongoDB authentication, no direct port exposure
4. **Application Security** - Security headers, rate limiting (via Caddy)
5. **Secrets Management** - Docker secrets, documented sensitive variables
6. **Security Logging** - Failed authentication attempts logged with IP addresses

## Security Headers

Security headers are configured in Caddy and include:

- **Strict-Transport-Security (HSTS)** - Enforces HTTPS connections
- **X-Content-Type-Options** - Prevents MIME type sniffing
- **X-Frame-Options** - Clickjacking protection
- **X-XSS-Protection** - XSS protection
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Restricts browser features
- **Content-Security-Policy** - Restricts content sources

See `Caddyfile` and `Caddyfile.local` for configuration details.

## Rate Limiting

Rate limiting is configured in Caddy but requires the `caddy-ratelimit` plugin:

- **API endpoints**: 100 requests/minute per IP (production)
- **Web endpoints**: 200 requests/minute per IP (production)
- **Local development**: Higher limits (500/1000 requests/minute)

To enable rate limiting:

1. Build Caddy with the rate limit plugin:
   ```bash
   xcaddy build --with github.com/mholt/caddy-ratelimit
   ```

2. Update `docker-compose.yml` to use the custom Caddy image

3. Uncomment the rate limiting configuration in `Caddyfile`

## MongoDB Security

MongoDB is configured with:

- **Authentication enabled** - Admin and application users required
- **No port exposure** - Only accessible through Docker network
- **Secrets management** - Passwords stored in Docker secrets
- **Network isolation** - Database network is internal-only

### Setup

1. Create password files in `secrets/`:
   ```bash
   echo "your-strong-admin-password" > secrets/mongo_admin_password.txt
   echo "your-strong-app-password" > secrets/mongo_app_password.txt
   chmod 600 secrets/mongo_admin_password.txt secrets/mongo_app_password.txt
   ```

2. Update `.env` with MongoDB connection string:
   ```
   MONGO_URL=mongodb://meriter_user:your-strong-app-password@mongodb:27017/meriter?authSource=meriter
   MONGO_APP_PASSWORD=your-strong-app-password
   ```

## Docker Compose Security

### Resource Limits

All services have CPU and memory limits:
- **MongoDB**: 2 CPU, 2GB RAM (limit) / 0.5 CPU, 512MB RAM (reservation)
- **API**: 2 CPU, 2GB RAM (limit) / 0.5 CPU, 512MB RAM (reservation)
- **Web**: 2 CPU, 2GB RAM (limit) / 0.5 CPU, 512MB RAM (reservation)
- **Caddy**: 1 CPU, 512MB RAM (limit) / 0.25 CPU, 128MB RAM (reservation)

### Security Options

- **no-new-privileges**: Prevents privilege escalation
- **read_only**: Read-only root filesystem (where possible)
- **tmpfs**: Temporary filesystems for writable directories

### Network Isolation

Three separate networks:
- **meriter-frontend-network**: Web and Caddy (public-facing)
- **meriter-backend-network**: API and init containers
- **meriter-database-network**: MongoDB and API only (internal)

## Secrets Management

### Sensitive Variables

The following environment variables are sensitive and should never be committed:

- `JWT_SECRET` - JWT token signing secret
- `BOT_TOKEN` - Telegram bot token
- `MONGO_APP_PASSWORD` - MongoDB application user password
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` - S3 credentials
- OAuth client secrets (Google, Instagram, Apple, etc.)

### Best Practices

1. Use Docker secrets for sensitive data
2. Store secrets in secure secret management systems (HashiCorp Vault, AWS Secrets Manager)
3. Rotate secrets regularly
4. Never commit `.env` files or actual secrets
5. Use strong, randomly generated passwords

## Security Logging

Security events are logged with the `[SECURITY]` prefix:

- **Failed authentication attempts** - Logged with IP address, path, and user agent
- **Invalid JWT tokens** - Signature failures, expired tokens, etc.
- **User not found** - Valid token but user doesn't exist

Logs include:
- Client IP address
- Request path
- User agent (truncated to 100 chars)
- Error details (without exposing secrets)

## Container Security

### Non-Root Users

All containers run as non-root users:
- **API**: `nestjs` user (UID/GID from nodejs group)
- **Web**: `nextjs` user (UID/GID from nodejs group)
- **MongoDB**: Runs as `mongodb` user (handled by official image)

### Image Tags

Specific image tags are used instead of `latest`:
- `node:22.11-alpine` - Node.js images
- `mongo:8.0` - MongoDB image
- `caddy:2.7-alpine` - Caddy image

## Health Checks

Health checks are configured for all services:
- Minimal endpoints that don't expose sensitive information
- Proper timeouts and retry logic
- Start periods to allow services to initialize

## Backup and Recovery

MongoDB data is persisted in Docker volumes:
- Volume: `mongodb_data`
- Location: Managed by Docker

### Backup Recommendations

1. Regular automated backups of `mongodb_data` volume
2. Test restore procedures
3. Store backups in secure, off-site location
4. Encrypt backup data

## Security Incident Response

If a security incident is detected:

1. **Immediate Actions**:
   - Rotate all secrets (JWT_SECRET, BOT_TOKEN, database passwords)
   - Review security logs for suspicious activity
   - Check for unauthorized access

2. **Investigation**:
   - Review logs with `[SECURITY]` prefix
   - Check rate limiting logs (if enabled)
   - Review authentication failures

3. **Remediation**:
   - Update affected systems
   - Patch vulnerabilities
   - Update security configurations

## Compliance Notes

- Security headers comply with OWASP recommendations
- Container security follows Docker best practices
- Secrets management follows 12-factor app principles
- Network isolation follows defense-in-depth principles

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Caddy Security Headers](https://caddyserver.com/docs/caddyfile/directives/header)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)

