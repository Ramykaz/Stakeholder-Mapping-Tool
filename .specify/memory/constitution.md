# Constitution — Stakeholder Analysis Tool

> **Project:** AI-powered stakeholder analysis platform for UNDP
>
> **Project type:** Web App
> **Primary users:** UNDP analysts and developers/researchers
> **Tech stack:** Django · React · Supabase (PostgreSQL + pgvector) · Groq (Llama 3) · all-MiniLM-L6-v2 · Docker
> **Generated:** 2026-03-09
>
> This document defines the non-negotiable principles, architectural
> decisions, and behavioral contracts that guide this project.
> It is the authoritative reference for all contributors —
> human and AI alike.

---

## Operating model

This project uses **Spec-Driven Development (SDD)** with the
Spec-Kit pipeline and agentic AI tooling (Claude Code).

Every contributor and every AI agent working on this codebase
is expected to read, understand, and apply this constitution.
Principles are not suggestions — they are constraints.

**Pipeline:** `specify → plan → task → implement`

No behavior change is implemented without first completing
the spec and plan phases and receiving Project Lead approval.

---

## Team & roles

| Person | Role |
|---|---|
| Ramadan | Project Lead — owns delivery, reviews all specs and PRs, merges |
| Josue | Engineer — frontend, visualization, Cytoscape.js |
| Mert | Consultant — RAG architecture, embedding strategy |
| Muhammad | Consultant — knowledge graph methods, backend patterns |

**Engineers** submit specs and PRs for Ramadan's review before
merge. No self-merge.

**Consultants** (Mert, Muhammad) are domain advisors — reviewed
async before relevant specs are written, not co-implementors.

Review delays over 1 business day are raised as blockers
at standup.

---

## Product principles

1. **Executable First** — deliver working behavior, not just plans.
2. **Spec-Driven** — requirements and contracts are defined before
   implementation.
3. **Incremental Value** — each sprint delivers a usable,
   demo-able output.
4. **Simplicity Over Complexity** — start simple, add complexity
   only when required by evidence.
5. **Open by Default** — prefer free and open-source tools.
   Paid APIs require explicit justification.
6. **Reviewable Change** — architecture, dependency, model,
   and prompt changes are explicit and reviewable.

---

## Principles at a glance

| Category | Principles |
|---|---|
| Software Engineering | DRY, KISS, YAGNI, Clean Code, TDD |
| Testing | Test-after but before PR · sprint review gate |
| Architecture | Modularity, Explicit Contracts, Observability |
| Data | Schema Migrations, Supabase as single source of truth |
| DevOps | Docker from Day-1, CI/CD, Deterministic Builds |
| AI/LLM | Groq free tier · no LLM calls in CI · prompts versioned |
| Collaboration | SDD pipeline · Lead review · Scrum ceremonies |
| Documentation | Changelog, README, Pushed Specs, ADRs |

---

## Software Engineering

### DRY
Every piece of logic, config, or data structure has one
authoritative representation. No copy-pasting across pipeline
stages. Shared utilities live in dedicated modules.

### KISS
Default to the simplest solution. Each pipeline stage
(ingestion, NER, reasoning, graph) is implemented as a
focused, readable module — no premature abstraction.

### YAGNI
Do not build features not in the current sprint backlog.
No speculative generalization. Unused code is deleted,
not commented out.

### Clean Code
Names reveal intent. Functions do one thing.
Comments explain why, not what.
Linting and formatting are required on every PR.

### TDD — Flexible Enforcement
This is an exploratory new-feature project.
**Test-after is acceptable, but tests must exist before
any PR is submitted for review.**

Test requirements per sprint:
- Sprint 1 review: ingestion pipeline + NER endpoint tests
- Sprint 2 review: RAG reasoning + graph endpoint tests

No PR is merged without relevant tests passing.

---

## Architecture

### Modularity
The pipeline is divided into four self-contained modules:
```
ingestion/ → ner/ → reasoning/ → graph/
```

Each module has its own models, views, and tests.
Cross-module imports go through explicit interfaces only.

### Explicit Contracts
API contracts are defined in `specs/` before implementation.
Input/output schemas are explicit. Breaking changes require
versioning and migration notes.

### Observability
All LLM calls are logged with operation name, model,
token count, and latency. Silent failures are not acceptable.
Every deployable service exposes a `/health` endpoint.

---

## Data & State

### Supabase as Single Source of Truth
All data lives in Supabase (PostgreSQL + pgvector).
No local SQLite or in-memory state for persistence.
pgvector extension must be enabled before first migration.

### Schema Migrations
All schema changes are versioned Django migrations committed
to the repo. Migrations are backwards-compatible where possible.
Destructive changes require a documented rollback plan.

---

## AI / LLM

### Groq Free Tier (Llama 3)
Groq is the primary LLM provider. No paid API keys are
required to run this project.

Fallback: Ollama (fully local) if Groq is unavailable.

### No LLM Calls in CI
Tests mock LLM responses. Real Groq/Ollama calls are only
made in development and staging environments.

### Prompts are Versioned
Prompt templates live in `prompts/` and are treated as
code — changes go through spec review and are logged
in the changelog.

### NER Strategy
Based on literature review (Sprint 1, Wed Mar 11):
LLM-based NER (Groq/Llama) is preferred over SpaCy for
UNDP domain documents due to better zero-shot accuracy
on policy language without fine-tuning.
SpaCy may be used as a fast pre-filter if latency becomes
an issue in Sprint 2.

---

## DevOps & Delivery

### Docker from Day-1
The full stack runs via `docker-compose up` from day one.
No "works on my machine" — Docker is the standard environment
for all contributors.

### Day-1 Deployability
A staging environment with a live `/health` endpoint exists
by end of Sprint 1 (Friday Mar 13).

### Deterministic Builds
All dependency versions are pinned in `requirements.txt`
and `package.json`. No `latest` tags in Docker images.

### CI/CD
CI runs on every PR: lint, tests, Docker build.
Broken CI blocks merge. Main branch is always deployable.

---

## Collaboration

### Spec-Kit Pipeline (mandatory for all behavior changes)
```
specify → plan → task → implement → tests → spec review
→ code review → merge
```

Exemptions (assessed by Ramadan): typo fixes, config tweaks,
pure refactors with no behavior change.
When in doubt — run the pipeline.

### Review Model
- Engineer submits spec → Ramadan reviews before implementation
- Engineer submits PR → Ramadan reviews before merge
- No self-merge by engineers
- Ramadan's own work reviewed at weekly team sync

### Scrum Ceremonies
- Daily standup (async) — blockers surfaced immediately
- Sprint review — demo of deployed, working system
- Retrospective — end of Sprint 2 (Mar 20)

---

## Documentation

### Changelog
`CHANGELOG.md` updated on every sprint review.
Follows Conventional Commits + Semantic Versioning.

### Pushed Specs
All specs live in `specs/` and are committed before
implementation begins. Specs are frozen after shipping —
they are the durable record of intent.

### README
README contains: project overview, local setup (Docker),
environment variables, and how to run tests.
Updated whenever setup steps change.

---

## Amendment process

Amendments require:
1. Proposed change written up as a PR to this file
2. Reviewed and approved by Ramadan at team sync
3. Version bump in the header

> **Version:** v1.0.0
> **Ratified:** 2026-03-09
> **Next review:** End of Sprint 2 (2026-03-20)