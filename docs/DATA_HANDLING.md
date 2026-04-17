# Data Handling and PII Policy

**Project:** UNDP Stakeholder Analysis Tool
**Owner:** SDG AI Lab
**Effective Date:** 2026-04-17
**Review Cycle:** Annual

---

## 1. Purpose

This document describes what data is sent to external AI providers, how PII and sensitive
information is handled, and what safeguards are in place during document processing.

---

## 2. Data Flows to External LLM Providers

### 2.1 What is sent

During an extraction run, the following data is transmitted to the selected LLM provider:

| Data Element | Sent To Provider? | When |
|---|---|---|
| Document text (full chunks) | Yes | During NER extraction |
| Initiative profile context (name, country, objectives) | Yes | Injected into NER and NL query prompts |
| Entity names (for relation extraction) | Yes | As part of relation extraction prompt |
| User queries (NL query endpoint) | Yes | On every NL query submission |
| User names or credentials | No | Never |
| Authentication tokens | No | Never |
| File metadata (filename, upload time) | No | Not transmitted to providers |

### 2.2 Which providers are used

The provider is selected per project by an admin. Available providers:

| Provider | Data Region | Zero-Retention Available | Encryption in Transit |
|---|---|---|---|
| Groq | US (AWS) | Per Groq ToS | TLS 1.2+ |
| OpenAI | US/EU | ZDR tier (Enterprise) | TLS 1.2+ |
| Azure OpenAI | Configurable (project endpoint) | Yes (default for API) | TLS 1.2+ |
| Google Gemini | US | Per Google Cloud DPA | TLS 1.2+ |

---

## 3. PII in Documents

### 3.1 What may be present

Documents analyzed by this tool may contain:
- **Names** of individuals (politicians, officials, civil society leaders)
- **Organizations** and their representatives
- **Locations** (countries, regions, addresses)
- **Contact information** (emails, phone numbers) — rare but possible in source documents
- **Financial information** (budget figures, donor amounts)

This tool is designed for **stakeholder analysis of publicly available documents** (policy
papers, project documents, reports). It is **not** designed for processing documents containing:
- Health records or medical data
- Biometric data
- Financial account details (credit cards, bank accounts)
- Children's data

### 3.2 Current safeguards

- **Content safety filter** (`ner/services/content_safety.py`): Regex-based post-processing
  of LLM outputs to detect and redact patterns resembling credentials, SSNs, and credit card
  numbers. Applied to all LLM response text before it is stored.
- **Prompt injection filter**: Detects and strips common prompt injection patterns from LLM
  output text.
- **No PII pre-screening before sending to LLM**: Documents are not pre-screened for PII
  before transmission. Users are responsible for ensuring that documents are appropriate
  for external processing. See Section 4.

### 3.3 Limitations

- The content safety filter operates on LLM **output**, not on **input** documents. Sensitive
  data in source documents is transmitted to the LLM provider.
- There is no automated PII detection or redaction on uploaded documents before they are
  chunked and sent for extraction.

**Roadmap:** PII pre-screening on input text (spaCy NER for PERSON/CONTACT) with configurable
redaction is planned for a future release.

---

## 4. User Responsibilities

Users uploading documents to this tool are responsible for:

1. **Legal basis**: Ensuring there is an appropriate legal basis for processing the personal
   data contained in the documents.
2. **Document selection**: Not uploading documents containing special-category personal data
   (health, biometrics, criminal records) or children's data.
3. **Provider selection**: Selecting a provider consistent with the data sensitivity level and
   any applicable data transfer restrictions (e.g., EU data protection requirements).

For projects involving sensitive stakeholder data, use **Azure OpenAI** configured to an EU
region or the **local Groq option** where available.

---

## 5. Access Controls

- All API endpoints require authentication (Token-based DRF authentication).
- Project data is not shared between users; each project is accessible only to authenticated
  users (current version has a shared user model — multi-tenancy isolation planned).
- Database credentials and API keys are stored as environment variables, not in code.
- Admin-only endpoints are protected by `is_admin` flag checks.

---

## 6. Contact and Escalation

For data protection questions or to report a potential data incident, contact the SDG AI Lab
system administrator and raise an issue in the project repository.

For production deployments, a formal Data Protection Impact Assessment (DPIA) should be
completed before going live with documents containing personal data.
