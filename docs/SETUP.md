# Setup Guide — UNDP Stakeholder Analysis Platform
## Complete Environment Setup from Scratch

**Last Updated**: 2026-03-26

---

## Overview

This application consists of two services run together via Docker Compose:

| Service | Technology | Port |
|---------|------------|------|
| **Backend** (API) | Python 3.11 + Django 4.2 | `http://localhost:8000` |
| **Frontend** (UI) | Next.js 14 + TypeScript | `http://localhost:3000` |

The database is hosted externally on **Supabase** (PostgreSQL 15 + pgvector). You do not run a local database — you connect to Supabase.

---

## System Requirements

### Required Software

| Tool | Minimum Version | How to Check | Download |
|------|----------------|--------------|----------|
| **Docker Desktop** | 4.x (includes Compose v2) | `docker --version` | https://www.docker.com/products/docker-desktop |
| **Git** | 2.x | `git --version` | https://git-scm.com |

> **Windows users**: Docker Desktop for Windows requires WSL 2 (Windows Subsystem for Linux) to be enabled. Docker Desktop will prompt you to enable it during installation.

> **macOS users**: Docker Desktop for Mac works on both Intel and Apple Silicon (M1/M2/M3).

### What Docker Installs for You (No Manual Setup Needed)
- Python 3.11 and all Python dependencies
- Node.js 20 and all frontend dependencies
- The `all-MiniLM-L6-v2` embedding model (baked into the image at build time)
- The `en_core_web_sm` spaCy language model
- CPU-only PyTorch (~600MB saved vs GPU version)
- DejaVu fonts for PDF report generation

### Optional (for running tests locally without Docker)
- Python 3.11
- Node.js 20

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/SDG-AI-Lab/stakeholder-analysis-tool.git
cd stakeholder-analysis-tool
```

---

## Step 2 — Set Up Supabase (Database)

This project uses Supabase as the managed PostgreSQL + pgvector database.

### 2.1 Create a Supabase Project
1. Go to https://supabase.com and sign in (free account works)
2. Click **New Project**
3. Choose a name (e.g. `stakeholder-analysis`), a strong database password, and a region close to you
4. Click **Create new project** — wait ~2 minutes for it to initialize

### 2.2 Enable pgvector Extension
1. In your Supabase project, go to **Database** → **Extensions**
2. Search for `vector`
3. Enable the **vector** extension
4. **This is required** — the embedding search will fail without it

### 2.3 Get Your Connection String
1. In Supabase, go to **Settings** → **Database**
2. Under **Connection string**, select **URI** format
3. Copy the string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Add `?sslmode=require` to the end:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```
5. Keep this string — you will need it in Step 3

---

## Step 3 — Configure Environment Variables

### 3.1 Create the Backend `.env` File

In the project root, copy the example file:

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# ─── Required ────────────────────────────────────────────────────────────────

# Your Supabase PostgreSQL connection string (from Step 2.3)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require

# Django mode — keep True for local development
DEBUG=True

# Allowed hostnames for Django
ALLOWED_HOSTS=localhost,127.0.0.1

# ─── LLM Providers (at least one required for entity extraction) ───────────

# Groq — free tier, recommended for getting started
# Get your key at: https://console.groq.com/keys
GROQ_API_KEY=gsk_your_groq_api_key_here

# OpenAI — optional, needed only if you select the OpenAI provider
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key-here

# Azure OpenAI — optional, needed only if using Azure endpoint
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-key-here
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

# Google Gemini — optional
GEMINI_API_KEY=your-gemini-key-here
```

> **Minimum to get started**: Fill in `DATABASE_URL` and at least `GROQ_API_KEY`. The app will start without LLM keys but entity extraction will fail.

### 3.2 Frontend Environment (Optional — Already Pre-Set)

The frontend already has a working `.env.local` at `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

You do not need to change this for local development.

---

## Step 4 — Build and Start the Application

> **First-time build takes 10–20 minutes** because Docker must download the base images, install Python packages, download PyTorch (CPU), the spaCy model, and bake the embedding model into the image. Subsequent starts take only a few seconds.

### 4.1 Build Both Services

```bash
docker compose build
```

Expected output includes steps for:
- Installing Python packages from `requirements.txt`
- Downloading and installing spaCy `en_core_web_sm` model
- Downloading and saving `all-MiniLM-L6-v2` embedding model
- Installing Node.js packages and building the Next.js frontend

### 4.2 Start the Services

```bash
docker compose up -d
```

The `-d` flag runs services in the background (detached mode).

### 4.3 Verify They Are Running

```bash
docker compose ps
```

Expected output:
```
NAME                          STATUS          PORTS
stakeholder-analysis-app-1    Up (healthy)    0.0.0.0:8000->8000/tcp
stakeholder-analysis-frontend-1   Up          0.0.0.0:3000->3000/tcp
```

Both should show `Up`. The backend will show `(healthy)` after ~30 seconds once the health check passes.

### 4.4 Check Logs (If Something Fails)

```bash
# All services
docker compose logs

# Backend only
docker compose logs app

# Frontend only
docker compose logs frontend

# Follow logs in real time
docker compose logs -f app
```

---

## Step 5 — Run Database Migrations

Migrations run **automatically** on every container start via `entrypoint.sh`. You do not need to run them manually. On first startup, Django will:

1. Collect static files
2. Apply all database migrations (creating tables in your Supabase database)
3. Start the Gunicorn web server

To verify migrations ran:

```bash
docker compose logs app | grep -i migration
```

Expected: Lines showing `Applying ingestion.000X...` and `OK`

---

## Step 6 — Create an Admin User

After the containers are running, create a Django superuser for accessing the admin panel:

```bash
docker compose exec app python manage.py createsuperuser
```

Follow the prompts:
- **Username**: your email address (e.g. `admin@yourorg.com`)
- **Email**: same email
- **Password**: a strong password

This account can log into both the frontend application and `http://localhost:8000/admin`.

---

## Step 7 — Open the Application

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Frontend application (main UI) |
| `http://localhost:8000/admin` | Django Admin panel (superuser only) |
| `http://localhost:8000/api/v1/` | Backend REST API browser |
| `http://localhost:8000/health` | Health check endpoint |

---

## Step 8 — Seed Taxonomy Data (Optional but Recommended)

The app ships with default entity labels and relationship types in the database via Django migrations. If you want to verify or reset them:

```bash
docker compose exec app python manage.py shell -c "
from ner.models import EntityLabelConfig, RelationshipTypeConfig
print('Entity Labels:', EntityLabelConfig.objects.count())
print('Relationship Types:', RelationshipTypeConfig.objects.count())
"
```

Expected: both counts > 0. If they show 0, run:

```bash
docker compose exec app python manage.py loaddata initial_taxonomy
```

(If this fixture does not exist, create labels manually via the Admin panel at `http://localhost:8000/admin`.)

---

## Common Docker Commands

### Stop the Application
```bash
docker compose down
```

### Stop and Remove All Data (Full Reset)
```bash
docker compose down -v
```

> Warning: This removes Docker volumes. Your Supabase database data is safe — only local container data is removed.

### Restart a Single Service
```bash
docker compose restart app
docker compose restart frontend
```

### Rebuild After Code Changes

If you change backend Python code (Django views, models, etc.):
```bash
docker compose build app && docker compose up -d app
```

If you change frontend TypeScript/React code:
```bash
docker compose build frontend && docker compose up -d frontend
```

If you change the `Dockerfile` or `requirements.txt`:
```bash
docker compose build --no-cache app && docker compose up -d app
```

### Open a Shell Inside the Backend Container
```bash
docker compose exec app bash
```

### Open a Django Shell
```bash
docker compose exec app python manage.py shell
```

---

## Running Tests

The test suite uses mocked LLM calls and mocked embeddings — no API keys required:

```bash
# Run all backend tests
docker compose run --rm app pytest --tb=short

# Run with verbose output
docker compose run --rm app pytest -v

# Run a specific test file
docker compose run --rm app pytest ner/tests/ -v
```

Expected: All tests pass (126+ tests as of latest branch).

---

## Getting API Keys

### Groq (Free, Recommended for Getting Started)
1. Go to https://console.groq.com
2. Sign in with Google or GitHub
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy the key (starts with `gsk_`)
6. Paste into `.env` as `GROQ_API_KEY`

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy the key (starts with `sk-`)
4. Paste into `.env` as `OPENAI_API_KEY`
5. Note: requires a paid account with billing set up

### Google Gemini
1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**
3. Paste into `.env` as `GEMINI_API_KEY`

---

## Troubleshooting

### "Cannot connect to database"
- Check that `DATABASE_URL` in `.env` is correct and includes `?sslmode=require`
- Check that the pgvector extension is enabled in Supabase (Step 2.2)
- Verify your Supabase project is not paused (free tier projects pause after 7 days of inactivity — resume from the Supabase dashboard)

### "Port 3000 already in use"
```bash
# Find what is using port 3000
# On macOS/Linux:
lsof -i :3000
# On Windows (PowerShell):
netstat -ano | findstr :3000
```
Stop the conflicting process, then retry `docker compose up -d`.

### "Port 8000 already in use"
Same as above but for port 8000. Common cause: another Django or Gunicorn process already running.

### Backend container exits immediately
```bash
docker compose logs app
```
Most common causes:
- Invalid `DATABASE_URL` (wrong password, wrong host)
- Missing required environment variable in `.env`
- Supabase project paused

### Frontend shows "Failed to fetch" or blank data
- Verify the backend is running: `curl http://localhost:8000/health`
- Check `frontend/.env.local` has `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- Check there are no CORS errors in the browser DevTools console

### First build is very slow or appears stuck
The first build downloads ~2GB of dependencies (Python packages, PyTorch CPU, embedding model). This is normal. Do not interrupt it. Use `docker compose logs` to monitor progress.

### "No module named X" error in backend
The Python environment is inside the Docker image. If you add a new package to `requirements.txt`:
```bash
docker compose build --no-cache app
docker compose up -d app
```

### Extraction returns an error about the API key
- Ensure the correct key is set in `.env` for your chosen provider
- Restart the backend after editing `.env`:
  ```bash
  docker compose up -d app
  ```
  (Docker Compose re-reads `.env` on container restart)

---

## Project Structure Reference

```
stakeholder-analysis-tool/
├── .env.example          ← Copy to .env and fill in your values
├── .env                  ← Your local config (not committed to git)
├── docker-compose.yml    ← Defines app + frontend services
├── Dockerfile            ← Backend image (Python 3.11 + models)
├── entrypoint.sh         ← Runs migrations then starts Gunicorn
├── requirements.txt      ← Python dependencies
├── manage.py             ← Django management script
│
├── stakeholder_analysis/ ← Django project config (settings, urls, wsgi)
├── ingestion/            ← Document upload, parsing, chunking
├── ner/                  ← Entity extraction, NER, reports
├── graph/                ← Knowledge graph API
├── reasoning/            ← RAG reasoning layer
├── models/               ← Embedding model weights (baked into image)
├── prompts/              ← LLM prompt templates
│
└── frontend/
    ├── Dockerfile        ← Frontend image (Node.js 20 + Next.js build)
    ├── .env.local        ← Frontend env (API URL)
    ├── package.json      ← Node.js dependencies
    ├── pages/            ← Next.js page routes
    └── src/
        ├── components/   ← React components
        ├── lib/          ← Utilities (API client, graph styles, state)
        └── types/        ← TypeScript type definitions
```

---

## After Setup

Once the application is running:

1. Open `http://localhost:3000`
2. Register a new account
3. Promote your account to admin via `http://localhost:8000/admin` (optional, needed for taxonomy management)
4. Follow the **TESTER_GUIDE.md** for a complete walkthrough of all features

---

## Quick Reference Card

```bash
# First time setup
cp .env.example .env          # Create env file
# Edit .env with your values
docker compose build           # Build images (~10-20 min first time)
docker compose up -d           # Start services
docker compose exec app python manage.py createsuperuser  # Create admin user

# Daily use
docker compose up -d           # Start
docker compose down            # Stop
docker compose logs -f app     # View backend logs

# After code changes
docker compose build app && docker compose up -d app        # Backend change
docker compose build frontend && docker compose up -d frontend  # Frontend change

# Tests
docker compose run --rm app pytest --tb=short
```
