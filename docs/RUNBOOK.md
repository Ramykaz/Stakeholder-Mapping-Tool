# Operations Runbook — Stakeholder Analysis Tool

> On-call reference for diagnosing and resolving production incidents.

---

## Quick Reference

| Service | URL | Health check |
|---------|-----|--------------|
| Backend API | `https://<host>/api/v1/` | `GET /health` → `{"status": "ok"}` |
| Swagger UI | `https://<host>/api/schema/swagger-ui/` | Browser |
| Frontend | `https://<host>/` | HTTP 200 |

---

## Escalation Path

1. **On-call engineer** — check this runbook, attempt remediation
2. **Team lead** — if unresolved after 30 minutes or data loss suspected
3. **Supabase support** — for database incidents: [status.supabase.com](https://status.supabase.com)
4. **Groq/OpenAI/Gemini status** — for LLM provider outages

---

## Top 5 Failure Modes

### 1. Backend container fails to start

**Symptoms:** `GET /health` returns 502 or connection refused.

**Diagnosis:**
```bash
docker compose logs app --tail=50
docker compose ps
```

**Common causes:**
- `DATABASE_URL` misconfigured → migration fails at startup
- Missing required environment variable → `ImproperlyConfigured`
- Port already in use

**Fix:**
```bash
# Check env vars
docker compose exec app env | grep -E 'DATABASE_URL|SECRET_KEY|DEBUG'
# Restart
docker compose restart app
```

---

### 2. LLM provider calls fail (extraction/generation unavailable)

**Symptoms:** Users see "Provider temporarily unavailable" or 503 errors on AI features.

**Diagnosis:**
```bash
# Check Sentry for circuit breaker events
# Check logs for provider errors
docker compose logs app --tail=100 | grep -i 'circuit\|provider\|rate'
```

**Common causes:**
- API key expired or quota exhausted
- Circuit breaker open (3 consecutive failures)
- Provider outage

**Fix:**
```bash
# Rotate API key in .env and restart
docker compose restart app worker

# If circuit breaker is open, restart the worker to reset in-memory state
docker compose restart worker
```

**Check provider status:**
- Groq: [console.groq.com](https://console.groq.com)
- OpenAI: [status.openai.com](https://status.openai.com)
- Gemini: [status.cloud.google.com](https://status.cloud.google.com)

---

### 3. Celery worker not processing tasks

**Symptoms:** Extraction or generation jobs appear to hang; status never changes from `pending`.

**Diagnosis:**
```bash
docker compose logs worker --tail=50
docker compose exec app python -c "from celery import Celery; c = Celery(); c.conf.broker_url = '$CELERY_BROKER_URL'; print(c.control.inspect().active())"
```

**Fix:**
```bash
docker compose restart worker
```

---

### 4. Redis connection failure

**Symptoms:** Celery jobs fail; cache-related errors in logs; rate limiting broken.

**Diagnosis:**
```bash
docker compose logs redis --tail=20
docker compose exec redis redis-cli ping
```

**Fix:**
```bash
docker compose restart redis
# Worker and app will reconnect automatically
```

---

### 5. Database connection pool exhausted

**Symptoms:** `OperationalError: FATAL: remaining connection slots are reserved` in logs.

**Diagnosis:**
```bash
docker compose logs app --tail=50 | grep -i 'connection\|pool'
# Check Supabase dashboard → Database → Connections
```

**Fix:**
- Reduce `GUNICORN_WORKERS` in docker-compose.prod.yml
- Enable PgBouncer on Supabase (connection pooler)
- Restart the app to clear stale connections: `docker compose restart app`

---

## Useful Commands

```bash
# Tail all service logs
docker compose logs -f

# Run a one-off Django management command
docker compose exec app python manage.py shell

# Check migration status
docker compose exec app python manage.py showmigrations

# Run migrations manually
docker compose exec app python manage.py migrate

# Clear Redis cache
docker compose exec redis redis-cli FLUSHDB

# Check health endpoint
curl -s http://localhost/health | python -m json.tool
```

---

## Rollback Procedure

1. Identify the last known-good git SHA: `git log --oneline -10`
2. Rebuild with the previous image: `git checkout <sha> && docker compose build && docker compose up -d`
3. If the rollback involves a database migration: restore from Supabase backup (see [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md))
