---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: security
quality_attribute_name: Security
iso_characteristic: "ISO/IEC 27001 Information Security + OWASP Top 10"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 11
  partial: 4
  fail: 2
  na: 11
  applicable: 17
  score_pct: 76.5
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 1
  p2_important: 2
  p3_improvement: 3

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Security Audit — Frontend

> **Score**: 76.5% · 🟢 Solid
> **Results**: 11 pass · 4 partial · 2 fail · 11 n/a
> **Blockers**: 0 | **Critical**: 1 | **High**: 2
> **Audited**: 2026-04-17
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 27001 + OWASP Top 10

---

## Summary

The frontend is secure by design: TypeScript strict mode prevents many runtime errors, Token auth is enforced via the API client interceptor, no `dangerouslySetInnerHTML` found in user-facing components, and Next.js provides XSS protection by default. The main gaps are missing Content-Security-Policy headers, no HTTP security header configuration for the Next.js runtime, and no CSP nonce for inline scripts.

---

## Results

### ✅ PASS (11 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| SEC-001 | No secrets in source | No API keys in source; `NEXT_PUBLIC_API_BASE_URL` is the only public env var |
| SEC-003 | Environment configuration | API base URL from env var; no hardcoded hostnames |
| SEC-008 | No SQL injection surface | Frontend does not access DB directly; all data via API |
| SEC-009 | XSS protection | No `dangerouslySetInnerHTML` in production components (verified by security smoke test); React escapes by default |
| SEC-010 | Authentication | `lib/api.ts` interceptor attaches `Authorization: Token` header on all requests |
| SEC-011 | RBAC enforcement | Admin routes check `user.is_admin` before rendering admin UI |
| SEC-013 | Input validation | Forms use controlled inputs; empty/invalid submissions caught before API call |
| SEC-014 | Token storage | Auth token stored in `localStorage` (documented tradeoff); `logoutUser` clears tokens even on API failure |
| SEC-016 | API authentication | All API calls authenticated; `401` responses trigger logout |
| SEC-017 | Response handling | API responses parsed through typed interfaces; no raw eval |
| SEC-027 | Dependency pinning | `package-lock.json` committed; all versions locked |

### ⚠️ PARTIAL (4 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| SEC-002 | Dependency vulnerability scanning | `package-lock.json` committed | No `npm audit` step; no Snyk or Dependabot configured | medium |
| SEC-004 | HTTPS (frontend) | Production `NODE_ENV=production` in Dockerfile | No HSTS headers from Next.js; no `next.config.js` security headers | high |
| SEC-005 | Security headers | Next.js default headers | No `Content-Security-Policy`, no `X-Content-Type-Options`, no `Referrer-Policy` in `next.config.js` | high |
| SEC-014 | Token storage security | Logout clears localStorage on 401 | `localStorage` is vulnerable to XSS (vs. httpOnly cookies); documented but not mitigated | medium |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| SEC-005 | HTTP security headers | No `headers()` function in `next.config.js`; no CSP, no `X-Frame-Options`, no `Permissions-Policy` | high | P1 |
| SEC-012 | Rate limiting (frontend protection) | No frontend-side request throttling to prevent API hammering from client | medium | P2 |

### 🔍 N/A (11 items)

| Check ID | Item | Reason |
|----------|------|--------|
| SEC-006 | CORS | N/A — configured on backend |
| SEC-007 | CSRF | N/A — API uses Token auth |
| SEC-015 | File upload security | Handled on backend |
| SEC-018 | API response filtering | Handled on backend |
| SEC-019 | Docker security | Frontend Dockerfile has multi-stage build (covered in Flexibility); non-root not set |
| SEC-020 | Container secrets | Secrets not in frontend container |
| SEC-021 | Network segmentation | Infra level |
| SEC-022 | Prompt injection | N/A — frontend does not call LLMs |
| SEC-023–025 | AI pipeline security | N/A — backend concern |
| SEC-026 | CI/CD secrets | No CI/CD exists |
| SEC-028 | Branch protection | Repository-level |

---

## Remediation Roadmap

### P1 — Critical (fix before production)

#### SEC-005: HTTP Security Headers

**Current state:** No security headers set by Next.js server. CSP absent means XSS via injected scripts is possible.
**Fix:** Add to `next.config.js`:
```javascript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  },
];

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```
**Effort:** Short

---

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SEC-002 | npm audit | Add `npm audit --audit-level=high` to CI pipeline | Quick win |
| SEC-012 | Client rate limiting | Add debounce on AI trigger buttons; disable buttons during in-flight requests | Quick win |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SEC-014 | Token in httpOnly cookie | Migrate from localStorage to httpOnly cookie with SameSite=Strict for XSS resistance | Medium |

---

## Acceptance Criteria

- [ ] SEC-005 security headers added to `next.config.js` (P1)
- [ ] Quality attribute score ≥ 50% — currently 76.5% ✅
