# Backup & Recovery — Stakeholder Analysis Tool

---

## Database (Supabase PostgreSQL)

### Automatic Backups

Supabase provides automatic daily backups with a 7-day retention window on the Pro plan.

| Plan | Backup frequency | Retention | Point-in-time recovery |
|------|-----------------|-----------|------------------------|
| Free | Daily | 1 day | No |
| Pro | Daily | 7 days | Yes (last 7 days) |
| Enterprise | Custom | Custom | Yes |

**RTO (Recovery Time Objective):** < 4 hours  
**RPO (Recovery Point Objective):** < 24 hours (daily backup); < 1 minute (PITR on Pro+)

### Verify Backup Status

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Project → Database → Backups**
3. Confirm the latest backup timestamp is within the last 24 hours

### Restore from Backup

**Option A — Supabase Dashboard (recommended):**
1. Navigate to **Project → Database → Backups**
2. Select the desired backup point
3. Click **Restore** → confirm
4. Monitor restore progress (typically 10–30 minutes for production databases)
5. Restart backend services after restore completes:
   ```bash
   docker compose -f docker-compose.prod.yml restart app worker
   ```

**Option B — Point-in-time recovery (Pro plan):**
1. Navigate to **Project → Database → Backups → Point in Time**
2. Enter the target timestamp (UTC)
3. Confirm and monitor

**Option C — Manual `pg_dump` restore:**
```bash
# Dump (run from a machine with database access)
pg_dump "$DATABASE_URL" --no-owner --no-privileges -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restore to a new database
pg_restore --clean --no-owner --no-privileges -d "$DATABASE_URL" backup_<timestamp>.dump
```

---

## Redis (Celery broker / cache)

Redis holds ephemeral task queue and cache data only. **No persistent data** is stored in Redis.

**Recovery:** If Redis is lost, simply restart it. In-flight Celery tasks will be lost; users will need to re-trigger extractions/generations.

```bash
docker compose restart redis
```

---

## Application Code

Application code is managed via Git. Recovery means deploying from the desired git commit:

```bash
git checkout <sha>
docker compose build
docker compose up -d
```

---

## ML Models

`all-MiniLM-L6-v2` is baked into the Docker image at build time. It is re-downloaded from HuggingFace during `docker build` if the image is rebuilt from scratch.

---

## Post-Restore Checklist

- [ ] Backend health check returns 200: `curl http://localhost/health`
- [ ] Frontend loads and user can log in
- [ ] Spot-check a project: entities and documents visible
- [ ] AI extraction runs (test with a small document)
- [ ] No migration errors: `docker compose exec app python manage.py showmigrations`
- [ ] Sentry shows no new critical errors after restore
