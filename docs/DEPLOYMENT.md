# Deployment Guide — Stakeholder Analysis Tool

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- A Supabase project (PostgreSQL 15 + pgvector extension enabled)
- API keys for at least one LLM provider (Groq recommended)
- A Sentry project for error monitoring (optional but recommended)

---

## Production Checklist

Before going live, verify all items below:

### Environment
- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` is a strong random value (at least 50 characters)
- [ ] `DATABASE_URL` points to production Supabase instance with `?sslmode=require`
- [ ] `ALLOWED_HOSTS` includes your production domain
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `SECURE_HSTS_SECONDS=31536000`
- [ ] `SESSION_COOKIE_SECURE=True`
- [ ] `CSRF_COOKIE_SECURE=True`
- [ ] `CSRF_TRUSTED_ORIGINS` includes your domain
- [ ] At least one LLM API key set
- [ ] `SENTRY_DSN` configured

### Infrastructure
- [ ] `REDIS_PASSWORD` set in environment
- [ ] nginx config reviewed for your domain
- [ ] SSL certificate provisioned (Let's Encrypt or managed)
- [ ] `docker compose -f docker-compose.prod.yml build` succeeds

### Database
- [ ] pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Migrations applied: `docker compose exec app python manage.py migrate`
- [ ] Supabase backup retention confirmed (≥ 7 days on Pro plan)

---

## First Deploy

```bash
# 1. Clone the repository
git clone <repo-url> && cd stakeholder-analysis-tool

# 2. Create production environment file
cp .env.example .env
# Edit .env — fill in all required values

# 3. Add REDIS_PASSWORD to .env
echo "REDIS_PASSWORD=$(openssl rand -hex 32)" >> .env

# 4. Build images
docker compose -f docker-compose.prod.yml build

# 5. Run migrations
docker compose -f docker-compose.prod.yml run --rm app python manage.py migrate

# 6. Collect static files
docker compose -f docker-compose.prod.yml run --rm app python manage.py collectstatic --no-input

# 7. Start all services
docker compose -f docker-compose.prod.yml up -d

# 8. Verify health
curl http://localhost/health
```

---

## Updating (zero-downtime)

```bash
git pull
docker compose -f docker-compose.prod.yml build app worker frontend
docker compose -f docker-compose.prod.yml run --rm app python manage.py migrate
docker compose -f docker-compose.prod.yml up -d --no-deps app worker frontend
```

---

## SSL with nginx and Let's Encrypt

For HTTPS, replace the nginx `listen 80;` block in `nginx/nginx.conf` with:

```nginx
listen 80;
location /.well-known/acme-challenge/ { root /var/www/certbot; }
location / { return 301 https://$host$request_uri; }
```

Add a second server block for port 443:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.example.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    # ... rest of your location blocks
}
```

Add `certbot` service to `docker-compose.prod.yml` and follow the [certbot nginx guide](https://certbot.eff.org/instructions).

---

## Rollback

```bash
# Identify last good commit
git log --oneline -5

# Rebuild from that commit
git checkout <sha>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# If migration rollback is needed, restore from Supabase backup
# See docs/BACKUP_RECOVERY.md
```

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `SECRET_KEY` | Yes | Django secret key (min 50 chars) |
| `DEBUG` | Yes | `False` in production |
| `ALLOWED_HOSTS` | Yes | Comma-separated hostnames |
| `GROQ_API_KEY` | At least one LLM key | Groq API key |
| `OPENAI_API_KEY` | At least one LLM key | OpenAI API key |
| `GEMINI_API_KEY` | At least one LLM key | Google Gemini API key |
| `REDIS_URL` | Yes | Redis connection URL |
| `REDIS_PASSWORD` | Yes (prod) | Redis authentication password |
| `SENTRY_DSN` | Recommended | Sentry DSN for error monitoring |
| `SENTRY_ENVIRONMENT` | Recommended | e.g. `production` |
| `SECURE_SSL_REDIRECT` | Yes (prod) | `True` |
| `CSRF_TRUSTED_ORIGINS` | Yes (prod) | `https://yourdomain.example.com` |
