# Contributing Guide

Thank you for contributing to the Stakeholder Analysis Tool.

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-desc>` | `feat/persona-export` |
| Bug fix | `fix/<short-desc>` | `fix/extraction-timeout` |
| Chore / docs | `chore/<short-desc>` | `chore/update-deps` |
| QA / testing | `test/<short-desc>` | `test/add-api-coverage` |

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

Examples:
```
feat(ner): add Gemini 1.5 Pro to provider allowlist
fix(frontend): correct 401 redirect loop on token expiry
docs: add deployment guide
test(api): add integration tests for extraction endpoint
```

---

## Pull Request Process

1. Branch from `main` using the naming convention above
2. Write or update tests for any changed behaviour
3. Ensure CI passes (GitHub Actions: backend tests + frontend tests + lint)
4. Open a PR against `main` with a clear title and description
5. Request review from at least one team member
6. Squash-merge once approved

---

## Test Requirements

### Backend
- All new views must have at least one test in `tests/`
- Use `pytest-django` fixtures for database setup
- Do not mock the database in integration tests
- Run locally: `cd src && pytest`

### Frontend
- New components with logic require a Jest test
- Use `@testing-library/react` for component tests
- Run locally: `cd frontend && npm test`

---

## Code Style

### Python
- Follow PEP 8 (enforced by `ruff`)
- Run linter: `ruff check .`
- Format: `ruff format .`

### TypeScript
- Strict TypeScript (`"strict": true` in `tsconfig.json`)
- Run linter: `cd frontend && npm run lint`

---

## Environment Setup

See [docs/SETUP.md](docs/SETUP.md) for the full setup guide.

Quick start:
```bash
cp .env.example .env  # fill in values
docker compose up
```
