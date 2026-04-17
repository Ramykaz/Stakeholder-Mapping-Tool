# Data Retention Policy

**Project:** UNDP Stakeholder Analysis Tool
**Owner:** SDG AI Lab
**Effective Date:** 2026-04-17
**Review Cycle:** Annual

---

## 1. Purpose

This document defines the data retention and deletion policy for all data processed and stored by
the Stakeholder Analysis Tool. It applies to all deployment environments including production,
staging, and any developer instances handling real project data.

---

## 2. Data Categories and Retention Periods

### 2.1 Project Documents (uploaded files)

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Uploaded PDF/DOCX/text files | Duration of project + 90 days after archive | Files are the source of truth for extraction |
| Raw document text (cleaned) | Same as parent document | Derived from uploaded file |
| Document chunks | Same as parent document | Deleted on document delete (cascade) |

### 2.2 Extracted Entities and Relations

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Entities | Duration of project | Deleted on project delete (cascade) |
| Relations | Duration of project | Deleted on document or project delete (cascade) |
| NER run records (tokens, cost) | 12 months from run date | Billing audit trail |

### 2.3 AI-Generated Content

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Stakeholder report sections | Duration of project | User-editable; project deliverable |
| SMQ answers | Duration of project | Project deliverable |
| Personas and workplan | Duration of project | Project deliverable |
| Contextual entity summaries | 7 days (cache TTL) | Auto-regenerated on demand |
| NL query answers | Not persisted | Only returned in API response |

### 2.4 User Accounts

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| User profile (username, email) | Account lifetime + 30 days after deletion | Audit linkage |
| Authentication tokens | Invalidated on logout; purged after 30 days of inactivity | Security |
| Activity audit logs | 12 months | Security and compliance |

### 2.5 AI Feedback

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Thumbs up/down/flag records | 12 months | Model quality improvement |
| Feedback comments | 12 months | Reviewed quarterly |

### 2.6 Application Logs

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Structured application logs (stdout) | 30 days (hosting platform) | Debugging and audit |
| Sentry error events | 90 days | Error resolution |
| Prometheus metrics | 15 days (Prometheus default) | Performance monitoring |

---

## 3. Data Deletion Procedures

### 3.1 Project Deletion

When a project is deleted via the API (`DELETE /api/v1/projects/{id}/`):
- All project documents, chunks, entities, relations are deleted by database cascade
- Generated content (report sections, SMQ answers, personas, workplan) is deleted by cascade
- NER run records linked to project documents are deleted by cascade
- Entity summary cache entries are invalidated within the next cache TTL cycle

Deletion is **immediate and irreversible**. The UI requires type-to-confirm before deletion.

### 3.2 User Account Deletion

User deletion must be performed via the Admin API or directly in the database. There is no
self-service account deletion in the current version. To request deletion, users should contact
their system administrator.

On deletion:
- User profile and authentication tokens are purged immediately
- Projects and documents owned by the user are **not** automatically deleted (they remain
  accessible to admins)

### 3.3 Scheduled Purges

The following cleanup tasks should be scheduled:
- **Stale session tokens**: `manage.py clearsessions` — weekly
- **Expired entity summaries**: handled by Redis TTL automatically
- **NER runs older than 12 months**: manual SQL or management command (not yet automated — see backlog)

---

## 4. External Data Processor Retention

When documents are processed via external LLM providers, the following third-party retention
policies apply:

| Provider | API data retention | Policy reference |
|----------|-------------------|-----------------|
| Groq | Not used for training; request logs retained per Groq ToS | groq.com/privacy |
| OpenAI | Zero data retention (API tier with DPA); defaults may vary | openai.com/policies |
| Azure OpenAI | Data not used for training; logs retained per Microsoft DPA | Microsoft Enterprise Agreement |
| Google Gemini | API data not used for training; see Google Cloud DPA | cloud.google.com/terms/data-processing-addendum |

**Note:** Document text is sent to external LLM providers only during extraction runs. The text
sent is the full document content. Projects containing sensitive or personal data should use
Azure OpenAI or the on-premises Groq option where available.

---

## 5. Backups

The production database (Supabase PostgreSQL) is backed up automatically:
- **Frequency:** Daily automated backup
- **Retention:** 7 days of daily backups (Supabase free/Pro tier)
- **Point-in-time recovery (PITR):** Available on Supabase Pro tier (7 days)

See `BACKUP_RECOVERY.md` for restore procedures.

---

## 6. Compliance Notes

- No special category data (health, biometric) is expected to be processed.
- Documents containing names, organizations, and contact information are processed as part of
  stakeholder analysis. Users are responsible for ensuring appropriate legal basis for processing.
- For GDPR data subject access or erasure requests, contact the system administrator.

---

## 7. Review and Contact

**Review:** This policy is reviewed annually or after significant system changes.
**Contact:** SDG AI Lab, UNDP — raise an issue in the project repository.
