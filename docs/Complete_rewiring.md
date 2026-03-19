/.specify.tasks

# UNDP Stakeholder Analysis Tool — Full System Rewire
# Complete frontend UI redesign + backend alignment spec
# Stack: Django 4.2 backend · Next.js frontend · Supabase (PostgreSQL) · Celery · Redis

---

## WHAT THIS SPEC DOES

This spec rewires the entire existing application — frontend and backend — to align with a new design system and page structure. It does not replace business logic, data models, or API contracts. It:

1. Applies a global design system across every page and component
2. Rewires all existing API responses into new visual components
3. Adds missing frontend UI where pages currently show raw data, empty states, or broken layouts
4. Adds missing backend endpoints where the frontend needs data that has no current API
5. Replaces the landing page entirely with a proper marketing page
6. Ensures auth flow, project flow, document flow, and graph flow are all visually complete and wired end to end

Complete every task in the order listed. Each task builds on the previous one.

---

## TASK 0 — GLOBAL DESIGN SYSTEM

Apply to: every page, every component, root layout

### 0.1 Font installation
Add to root layout (`app/layout.tsx` or `_app.tsx` or `_document.tsx`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
```

### 0.2 CSS variables
Add to global stylesheet (globals.css or equivalent), applied to `:root`:
```css
:root {
  --bg:           #080c14;
  --bg2:          #0d1220;
  --bg3:          #111827;
  --border:       rgba(255,255,255,0.06);
  --border2:      rgba(255,255,255,0.11);
  --text:         #e4e8f4;
  --text2:        #7b8299;
  --text3:        #444d66;
  --accent:       #3d6fff;
  --accent-soft:  rgba(61,111,255,0.12);
  --teal:         #2ec4a5;
  --teal-soft:    rgba(46,196,165,0.10);
  --purple:       #9b6ef3;
  --purple-soft:  rgba(155,110,243,0.10);
  --amber:        #f5a623;
  --amber-soft:   rgba(245,166,35,0.10);
  --coral:        #f0614a;
  --coral-soft:   rgba(240,97,74,0.10);
  --serif: 'DM Serif Display', Georgia, serif;
  --sans:  'Outfit', system-ui, sans-serif;
  --mono:  'DM Mono', monospace;
}
```

### 0.3 Global base styles
```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbars */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

### 0.4 Reusable component classes
```css
/* Buttons */
.btn-primary {
  background: var(--accent); color: #fff; border: none;
  border-radius: 8px; padding: 10px 22px;
  font-family: var(--sans); font-size: 13px; font-weight: 500;
  cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  transition: opacity .15s, transform .15s;
}
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.btn-primary-lg {
  padding: 13px 28px; font-size: 15px; border-radius: 10px;
}

.btn-ghost {
  background: transparent; border: 1px solid var(--border2);
  color: var(--text2); border-radius: 8px; padding: 9px 20px;
  font-family: var(--sans); font-size: 13px; font-weight: 400;
  cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  transition: border-color .15s, color .15s;
}
.btn-ghost:hover { border-color: rgba(255,255,255,0.22); color: var(--text); }

/* Inputs */
input, textarea, select {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 8px; color: var(--text); font-family: var(--sans);
  font-size: 14px; padding: 10px 14px; outline: none; width: 100%;
  transition: border-color .15s, box-shadow .15s;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
input::placeholder, textarea::placeholder { color: var(--text3); }

/* Cards */
.card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px 24px;
  transition: border-color .15s;
}
.card:hover { border-color: var(--border2); }

/* Badges — map existing status strings to these */
.badge {
  font-family: var(--mono); font-size: 10px; padding: 3px 9px;
  border-radius: 20px; border: 1px solid; display: inline-flex;
  align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0;
}
.badge-live  { color: var(--teal);   background: var(--teal-soft);   border-color: rgba(46,196,165,0.25); }
.badge-proc  { color: var(--amber);  background: var(--amber-soft);  border-color: rgba(245,166,35,0.25); }
.badge-draft { color: var(--text2);  background: transparent;        border-color: var(--border2); }
.badge-error { color: var(--coral);  background: var(--coral-soft);  border-color: rgba(240,97,74,0.25); }

/* Status → badge class mapping (apply in JS/JSX):
   "ready"|"active"|"processed"|"complete" → badge-live
   "processing"|"queued"|"pending"         → badge-proc
   "draft"|"new"|"created"                 → badge-draft
   "error"|"failed"                        → badge-error
*/

/* Section label */
.section-label {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--text3);
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.section-label::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}

/* Divider */
hr, .divider { border: none; border-top: 1px solid var(--border); margin: 0; }
```

### 0.5 Typography helpers
```css
.display { font-family: var(--serif); color: #fff; line-height: 1.1; }
.mono    { font-family: var(--mono); }
.muted   { color: var(--text2); }
.dimmed  { color: var(--text3); }
```

### 0.6 Entity type → color + shape mapping
Store this as a frontend constant (`lib/entityTypes.ts`) and reference throughout:
```ts
export const ENTITY_TYPE_MAP = {
  Organization:        { color: '#3d6fff', shape: 'circle'   },
  Government:          { color: '#3d6fff', shape: 'square'   },
  Person:              { color: '#2ec4a5', shape: 'hexagon'  },
  'Policy/Initiative': { color: '#9b6ef3', shape: 'diamond'  },
  Location:            { color: '#f5a623', shape: 'circle'   },
  Event:               { color: '#9b6ef3', shape: 'diamond'  },
  Project:             { color: '#9b6ef3', shape: 'diamond'  },
  'Concept/Theme':     { color: '#f0614a', shape: 'triangle' },
  Role:                { color: '#7b8299', shape: 'circle'   },
} as const;

export function getStatusBadgeClass(status: string): string {
  if (['ready','active','processed','complete'].includes(status)) return 'badge-live';
  if (['processing','queued','pending'].includes(status))         return 'badge-proc';
  if (['error','failed'].includes(status))                        return 'badge-error';
  return 'badge-draft';
}
```

---

## TASK 1 — TOP NAVIGATION BAR

Apply to: all pages via shared layout component.
Rewire: existing auth state check, user object, nav links, logout handler.

### Visual spec
- Height: 52px
- Position: sticky top 0, z-index 100
- Background: `var(--bg2)`
- Border-bottom: `1px solid var(--border)`
- Backdrop-filter: `blur(12px)`
- Layout: flex, align-items center, padding 0 24px, gap 16px

### Left — Logo (always shown)
```jsx
<a href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
  <div style={{
    width:26, height:26, borderRadius:7, background:'var(--accent)',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
  }}>
    {/* SVG: 3 circles connected by lines — node graph icon */}
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8">
      <circle cx="8" cy="8" r="2"/>
      <circle cx="8" cy="2.5" r="1.5"/><line x1="8" y1="4" x2="8" y2="6"/>
      <circle cx="13" cy="11" r="1.5"/><line x1="9.2" y1="8.8" x2="11.8" y2="10.2"/>
      <circle cx="3" cy="11" r="1.5"/><line x1="6.8" y1="8.8" x2="4.2" y2="10.2"/>
    </svg>
  </div>
  <span style={{ fontFamily:'var(--serif)', fontSize:18, color:'#fff', whiteSpace:'nowrap' }}>
    UNDP Stakeholder Analysis
  </span>
</a>
```

### Center — Search pill (authenticated pages only)
Render only when `isAuthenticated` is true (read from existing auth state).
Wire to existing search/filter handler if one exists, otherwise render as decorative for now.
```jsx
<div style={{
  flex:1, maxWidth:280, borderRadius:20, border:'1px solid var(--border2)',
  background:'var(--bg2)', display:'flex', alignItems:'center',
  gap:8, padding:'7px 14px', cursor:'pointer'
}}>
  {/* search icon SVG */}
  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
    Search entities, projects…
  </span>
</div>
```

### Right — Auth-dependent
If authenticated (read from existing auth/session state):
```jsx
<div
  onClick={/* existing user menu / logout handler */}
  style={{
    width:32, height:32, borderRadius:'50%', cursor:'pointer',
    background:'linear-gradient(135deg, var(--accent), var(--purple))',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily:'var(--mono)', fontSize:12, color:'#fff', fontWeight:500,
    flexShrink:0
  }}
>
  {/* user initials from existing user object: user.first_name[0] + user.last_name[0] */}
  {userInitials}
</div>
```

If unauthenticated:
```jsx
<a href="/auth/login"   className="btn-ghost" style={{fontSize:13}}>Sign in</a>
<a href="/auth/register" className="btn-primary" style={{fontSize:13}}>Get started</a>
```

---

## TASK 2 — SIDEBAR

Apply to: all authenticated pages via shared layout component.
Rewire: existing projects list API response, active project state, navigation handlers.

### Container
```css
width: 220px;
background: var(--bg2);
border-right: 1px solid var(--border);
height: 100%;
display: flex;
flex-direction: column;
overflow: hidden;
flex-shrink: 0;
```

### Top section
```jsx
<div style={{ padding:'16px 12px 12px', borderBottom:'1px solid var(--border)' }}>
  {/* Section label */}
  <div style={{
    fontFamily:'var(--mono)', fontSize:10, letterSpacing:'0.1em',
    textTransform:'uppercase', color:'var(--text3)', marginBottom:10
  }}>Projects</div>

  {/* New Project button — wire to existing handler */}
  <button
    onClick={/* existing new project handler */}
    className="btn-primary"
    style={{ width:'100%', padding:'7px 12px', fontSize:12, justifyContent:'center' }}
  >
    + New Project
  </button>
</div>
```

### Project list
Map over existing `projects` array from the existing API fetch:
```jsx
{projects.map(project => (
  <div
    key={project.id}
    onClick={/* existing navigate to project handler */}
    style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'7px 10px', borderRadius:8, cursor:'pointer',
      margin:'2px 8px',
      border: isActive(project.id) ? '1px solid rgba(61,111,255,0.25)' : '1px solid transparent',
      background: isActive(project.id) ? 'var(--accent-soft)' : 'transparent',
      transition:'background .15s',
    }}
  >
    {/* Status dot */}
    <div style={{
      width:6, height:6, borderRadius:'50%', flexShrink:0,
      background: project.status === 'ready' ? 'var(--teal)'
                : project.status === 'processing' ? 'var(--amber)'
                : 'var(--text3)'
    }}/>

    {/* Project name — read from existing project.name */}
    <span style={{
      fontFamily:'var(--sans)', fontSize:13, color:'var(--text)',
      flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
    }}>
      {project.name}
    </span>

    {/* Entity count — read from existing project.entity_count or project.entities_count */}
    <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>
      {project.entity_count ?? 0}
    </span>
  </div>
))}
```

### Bottom section
Map existing nav links (Settings, Help, user email) to:
```jsx
<div style={{ marginTop:'auto', padding:'12px 8px', borderTop:'1px solid var(--border)' }}>
  {/* Each nav item */}
  <div style={{
    display:'flex', alignItems:'center', gap:10,
    padding:'7px 10px', borderRadius:8, cursor:'pointer',
    fontFamily:'var(--sans)', fontSize:13, color:'var(--text2)',
    transition:'color .15s, background .15s',
  }}
  onMouseEnter={e => { e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
  onMouseLeave={e => { e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.background='transparent'; }}
  >
    {/* icon + label */}
  </div>
</div>
```

---

## TASK 3 — LANDING PAGE (unauthenticated `/` or `/home`)

Replace the existing landing page content entirely. Keep the route. Wire all CTA buttons to existing login/register routes.

If the existing system redirects `/` to `/projects` for authenticated users, keep that redirect — this page only renders for unauthenticated visitors.

### 3.1 Hero section
```jsx
<section style={{
  minHeight:'100vh', display:'flex', flexDirection:'column',
  alignItems:'center', justifyContent:'center', textAlign:'center',
  padding:'120px 48px 80px', position:'relative', overflow:'hidden'
}}>
  {/* Grid overlay */}
  <div style={{
    position:'absolute', inset:0, pointerEvents:'none',
    backgroundImage:`
      linear-gradient(rgba(61,111,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(61,111,255,0.04) 1px, transparent 1px)`,
    backgroundSize:'56px 56px',
    maskImage:'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
    WebkitMaskImage:'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
  }}/>

  {/* Radial glow */}
  <div style={{
    position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)',
    width:700, height:400, pointerEvents:'none',
    background:'radial-gradient(ellipse, rgba(61,111,255,0.07) 0%, transparent 70%)',
  }}/>

  {/* Eyebrow */}
  <div style={{
    display:'flex', alignItems:'center', gap:10, justifyContent:'center',
    marginBottom:24, opacity:0, animation:'fadeUp .6s .2s forwards'
  }}>
    <div style={{ width:24, height:1, background:'var(--accent)', opacity:0.4 }}/>
    <span style={{
      fontFamily:'var(--mono)', fontSize:11, letterSpacing:'0.12em',
      textTransform:'uppercase', color:'var(--accent)'
    }}>AI-Powered Stakeholder Mapping</span>
    <div style={{ width:24, height:1, background:'var(--accent)', opacity:0.4 }}/>
  </div>

  {/* H1 */}
  <h1 style={{
    fontFamily:'var(--serif)', fontSize:'clamp(42px, 6vw, 68px)',
    color:'#fff', lineHeight:1.08, maxWidth:800, margin:'0 auto 24px',
    opacity:0, animation:'fadeUp .6s .35s forwards'
  }}>
    Map who matters — and why they connect
  </h1>

  {/* Subheading */}
  <p style={{
    fontSize:17, color:'var(--text2)', maxWidth:520,
    lineHeight:1.7, margin:'0 auto 40px',
    opacity:0, animation:'fadeUp .6s .5s forwards'
  }}>
    Upload policy documents and let AI extract an interactive network of
    stakeholders — guided by your project context. Built for UNDP analysts
    and program teams.
  </p>

  {/* CTAs */}
  <div style={{
    display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap',
    opacity:0, animation:'fadeUp .6s .65s forwards'
  }}>
    <a href={/* existing register route */} className="btn-primary btn-primary-lg">
      Get started
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 8h10M9 4l4 4-4 4"/>
      </svg>
    </a>
    <a href="#how" className="btn-ghost" style={{ padding:'13px 28px', fontSize:15, borderRadius:10 }}>
      See how it works
    </a>
  </div>

  {/* Stats */}
  <div style={{
    display:'flex', gap:48, justifyContent:'center', flexWrap:'wrap',
    marginTop:72, opacity:0, animation:'fadeUp .6s .8s forwards'
  }}>
    {[
      { n:'14k+', l:'Entities extracted' },
      { n:'380+', l:'Projects mapped'   },
      { n:'97%',  l:'Extraction precision' },
    ].map(s => (
      <div key={s.l} style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:32, color:'#fff', lineHeight:1, marginBottom:4 }}>
          {s.n}
        </div>
        <div style={{ fontFamily:'var(--sans)', fontSize:12, color:'var(--text3)', letterSpacing:'0.03em' }}>
          {s.l}
        </div>
      </div>
    ))}
  </div>
</section>
```

### 3.2 Features grid
```jsx
<section style={{ padding:'80px 48px', maxWidth:1100, margin:'0 auto' }}>
  <div className="section-label">Capabilities</div>
  <h2 style={{ fontFamily:'var(--serif)', fontSize:'clamp(24px,3vw,38px)', color:'#fff', maxWidth:500, marginBottom:48 }}>
    Purpose-built for stakeholder mapping
  </h2>

  <div style={{
    display:'grid', gridTemplateColumns:'repeat(3,1fr)',
    gap:1, background:'var(--border)', borderRadius:16, overflow:'hidden'
  }}>
    {[
      { bg:'rgba(61,111,255,0.08)',  border:'rgba(61,111,255,0.2)',  title:'Concept-guided extraction',  body:'Write a concept note and the LLM extracts only contextually relevant entities — not every name in the document.' },
      { bg:'rgba(46,196,165,0.08)',  border:'rgba(46,196,165,0.2)',  title:'Interactive knowledge graph', body:'Explore a live network of nodes and edges. Filter by entity type, focus on clusters, trace relationship paths.' },
      { bg:'rgba(155,110,243,0.08)', border:'rgba(155,110,243,0.2)', title:'Entity detail profiles',      body:'Click any node for a full profile: description, all relationships, source documents, and an AI-generated role summary.' },
      { bg:'rgba(245,166,35,0.08)',  border:'rgba(245,166,35,0.2)',  title:'Natural language queries',    body:"Ask questions in plain English: 'Who funds this ecosystem?' or 'What connects these two organizations?'" },
      { bg:'rgba(240,97,74,0.08)',   border:'rgba(240,97,74,0.2)',   title:'Global entity registry',      body:'The same entity across projects exists once globally. Relationships are scoped per project — no duplication.' },
      { bg:'rgba(255,255,255,0.04)', border:'var(--border2)',         title:'Multi-document processing',  body:'Upload PDFs, DOCX, and text files. The graph grows incrementally as each document is processed.' },
    ].map(card => (
      <div key={card.title} style={{ background:'var(--bg2)', padding:'32px 28px', transition:'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e => e.currentTarget.style.background='var(--bg2)'}
      >
        <div style={{
          width:40, height:40, borderRadius:10, marginBottom:18,
          background:card.bg, border:`1px solid ${card.border}`,
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          {/* SVG icon — use a relevant simple icon per card */}
        </div>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:8 }}>{card.title}</div>
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.65 }}>{card.body}</div>
      </div>
    ))}
  </div>
</section>
```

### 3.3 How it works section
```jsx
<section id="how" style={{
  padding:'100px 48px', background:'var(--bg2)',
  borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)'
}}>
  <div style={{ maxWidth:1100, margin:'0 auto' }}>
    <div className="section-label">Process</div>
    <h2 style={{ fontFamily:'var(--serif)', fontSize:'clamp(24px,3vw,38px)', color:'#fff', marginBottom:64 }}>
      From documents to insight in four steps
    </h2>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', position:'relative' }}>
      {/* Connecting line */}
      <div style={{
        position:'absolute', top:24, left:'12.5%', right:'12.5%',
        height:1, background:'var(--border2)', zIndex:0
      }}/>

      {[
        { n:'01', title:'Create a project',    body:'Name it and write a concept note describing the stakeholder context you care about.' },
        { n:'02', title:'Write a concept note', body:'Tell the AI what this project is about and which stakeholder types matter. This guides every extraction.' },
        { n:'03', title:'Upload documents',     body:'Drop in PDFs, Word files, or text articles. Any combination of project-relevant files.' },
        { n:'04', title:'Explore the map',      body:'Navigate the graph, click nodes for detail, filter by type, and query in natural language.' },
      ].map((step, i) => (
        <div key={step.n} style={{ padding:'0 20px', position:'relative', zIndex:1 }}>
          <div style={{
            width:48, height:48, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--mono)', fontSize:13,
            background: i === 0 ? 'var(--accent)' : 'var(--bg2)',
            color:       i === 0 ? '#fff'         : 'var(--text2)',
            border:      i === 0 ? 'none'         : '1px solid var(--border2)',
          }}>
            {step.n}
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginTop:16, marginBottom:8 }}>{step.title}</div>
          <div style={{ fontSize:12.5, color:'var(--text2)', lineHeight:1.6 }}>{step.body}</div>
        </div>
      ))}
    </div>
  </div>
</section>
```

### 3.4 CTA band
```jsx
<section style={{ padding:'100px 48px', textAlign:'center' }}>
  <h2 style={{ fontFamily:'var(--serif)', fontSize:'clamp(26px,4vw,44px)', color:'#fff', maxWidth:560, margin:'0 auto 16px' }}>
    Ready to map your stakeholder network?
  </h2>
  <p style={{ color:'var(--text2)', marginBottom:32 }}>
    Used by UNDP policy analysts and program teams worldwide.
  </p>
  <a href={/* existing register route */} className="btn-primary btn-primary-lg">
    Create a free account
  </a>
</section>
```

### 3.5 Footer
```jsx
<footer style={{
  borderTop:'1px solid var(--border)', padding:'28px 48px',
  display:'flex', alignItems:'center'
}}>
  <span style={{ fontFamily:'var(--serif)', fontSize:16, color:'var(--text2)' }}>
    UNDP Stakeholder Analysis Tool
  </span>
  <span style={{ fontSize:12, color:'var(--text3)', marginLeft:16 }}>
    Built at UNDP SDG AI Lab
  </span>
  <div style={{ marginLeft:'auto', display:'flex', gap:20 }}>
    {['Privacy','Terms','Docs'].map(l => (
      <a key={l} href="#" style={{ fontSize:12, color:'var(--text3)', textDecoration:'none' }}>{l}</a>
    ))}
  </div>
</footer>
```

---

## TASK 4 — AUTH PAGES (`/auth/login`, `/auth/register`)

Rewire: existing form submit handlers, validation, error state, redirect on success.

### Backend — verify these endpoints exist, add if missing:
```
POST /api/auth/register/
  Body: { email, password, first_name, last_name, organization }
  Returns: { token, user: { id, email, first_name, last_name, organization } }
  Errors: 400 { field: "email", message: "..." } if email exists
          400 { field: "password", message: "..." } if password < 8 chars

POST /api/auth/login/
  Body: { email, password }
  Returns: { token, user: { id, email, first_name, last_name } }
  Errors: 401 { message: "Incorrect email or password." }

POST /api/auth/logout/
  Auth: Bearer token required
  Returns: 200

GET /api/auth/me/
  Auth: Bearer token required
  Returns: { id, email, first_name, last_name, organization }
```

Token storage: save as `localStorage.setItem('nexus_token', token)`. All API calls include `Authorization: Token <token>` header.

### Page layout: split-panel full viewport
```
┌─────────────────────────┬──────────────────────┐
│   LEFT (52%)            │   RIGHT (48%)        │
│   Brand + mini graph    │   Tabbed auth form   │
└─────────────────────────┴──────────────────────┘
```

### Left panel
- `background: var(--bg2); border-right: 1px solid var(--border)`
- Subtle grid background (same as hero, opacity 0.03)
- Top: Logo (same as nav)
- Middle: H2 "Map who matters — and why they connect" serif, italic "why they connect" in `var(--teal)`
- Sub: Outfit 14px `var(--text2)` — "Upload policy documents and let AI extract a living network of stakeholders."
- Mini graph SVG (static, ~7 nodes, same visual style as design system)
- Bottom: testimonial block with thin top border
  - Quote: 13px italic `var(--text2)` — "Nexus turned 80 pages of policy documents into a stakeholder map in under 3 minutes."
  - Avatar: 28px circle gradient + initials + name "Sara Fernandez" + role "Policy Analyst, UNDP Geneva"

### Right panel — tab switcher
Two tabs: "Sign in" | "Create account"
- Tab container: `background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 3px`
- Active tab: `background: var(--bg3); border: 1px solid var(--border2); color: var(--text)`
- Inactive: `color: var(--text2); background: transparent`

### Sign in form (rewire to existing login handler)
Fields: Email (`type=email`) · Password (`type=password`)
"Forgot password?" link right-aligned Outfit 12px `var(--text3)`
Submit: "Sign in →" full-width `btn-primary`
Divider "or continue with"
Google SSO button: `btn-ghost` full-width with Google SVG icon (wire to existing OAuth handler if present)
Error display: inline below relevant field, Outfit 12px `var(--coral)`
On success: redirect to `/projects`

### Create account form (rewire to existing register handler)
Fields: First name + Last name (side-by-side grid) · Work email · Organization · Password
Password strength meter below password field:
- `height: 3px; border-radius: 2px; background: var(--border2)` track
- Fill bar: width + color animate based on password score:
  - length ≥ 8 → 25% `var(--coral)`
  - + uppercase → 50% `var(--amber)`
  - + number → 75% `var(--teal)`
  - + special char → 100% `var(--accent)`
Submit: "Create account →" full-width `btn-primary`
Terms note: 11px `var(--text3)` centered
On success: redirect to `/projects/new` or `/projects`

---

## TASK 5 — PROJECTS DASHBOARD (`/projects`)

Rewire: existing projects list fetch, create project handler, navigate to project handler.

### Backend — verify these endpoints exist, add if missing:
```
GET /api/projects/
  Auth: required
  Returns: [{
    id, name, description, status, created_at, updated_at,
    entity_count, document_count, relationship_count
  }]

POST /api/projects/
  Auth: required
  Body: { name, description }
  Returns: { id, name, description, status: "draft", created_at }

PATCH /api/projects/{id}/
  Auth: required
  Body: { name?, description? }
  Returns: updated project object

DELETE /api/projects/{id}/
  Auth: required
  Returns: 204
```

If `entity_count`, `document_count`, `relationship_count` are not returned by the existing GET endpoint, add them as `@property` annotations to the Django serializer or queryset annotation.

### Page layout
- App shell: top nav + sidebar + main content area
- Main content: `padding: 40px; flex: 1; overflow-y: auto`

### Page header
```jsx
<div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
  <h1 style={{ fontFamily:'var(--serif)', fontSize:28, color:'#fff' }}>Your projects</h1>
  <button onClick={/* existing new project handler */} className="btn-primary">
    + New Project
  </button>
</div>
<p style={{ color:'var(--text2)', marginBottom:32 }}>
  Each project is an independent stakeholder map guided by its own concept note.
</p>
```

### Empty state (when projects.length === 0)
```jsx
<div style={{
  maxWidth:480, margin:'80px auto', padding:48, textAlign:'center',
  background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16
}}>
  <div style={{
    width:56, height:56, borderRadius:12, margin:'0 auto 20px',
    background:'var(--accent-soft)', border:'1px solid rgba(61,111,255,0.25)',
    display:'flex', alignItems:'center', justifyContent:'center'
  }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="4"  r="2"/><line x1="12" y1="6"  x2="12" y2="9"/>
      <circle cx="20" cy="18" r="2"/><line x1="14.6" y1="13.4" x2="18.4" y2="16.6"/>
      <circle cx="4"  cy="18" r="2"/><line x1="9.4"  y1="13.4" x2="5.6"  y2="16.6"/>
    </svg>
  </div>
  <h3 style={{ fontFamily:'var(--serif)', fontSize:24, color:'#fff', marginBottom:10 }}>
    No projects yet
  </h3>
  <p style={{ color:'var(--text2)', maxWidth:340, margin:'0 auto 28px' }}>
    Create your first project to start mapping stakeholder relationships from your documents.
  </p>
  <button onClick={/* existing create project handler */} className="btn-primary">
    Create your first project
  </button>
</div>
```

### Project cards grid (when projects.length > 0)
```jsx
<div style={{
  display:'grid',
  gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',
  gap:16
}}>
  {projects.map(project => (
    <ProjectCard key={project.id} project={project} />
  ))}
</div>
```

### ProjectCard component
```jsx
// Read all values from existing project object fields
// Wire onClick to existing navigate-to-project handler

<div
  onClick={/* existing navigate handler */}
  style={{
    background:'var(--bg2)', border:'1px solid var(--border)',
    borderRadius:14, padding:'22px 24px', cursor:'pointer',
    transition:'border-color .15s', position:'relative'
  }}
  onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
>
  {/* Top row */}
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
    <span className={`badge ${getStatusBadgeClass(project.status)}`}>
      {project.status}
    </span>
    {/* Overflow menu — keep existing handler, only show on hover */}
    <button
      onClick={e => { e.stopPropagation(); /* existing menu handler */ }}
      style={{
        background:'transparent', border:'none', color:'var(--text3)',
        cursor:'pointer', padding:4, opacity:0, transition:'opacity .15s'
      }}
      className="card-menu-btn"
    >⋮</button>
  </div>

  {/* Project name — from project.name */}
  <div style={{
    fontFamily:'var(--serif)', fontSize:20, color:'#fff',
    margin:'12px 0 6px', lineHeight:1.2
  }}>
    {project.name}
  </div>

  {/* Description — from project.description */}
  <div style={{
    fontSize:13, color:'var(--text2)', marginBottom:16,
    display:'-webkit-box', WebkitLineClamp:2,
    WebkitBoxOrient:'vertical', overflow:'hidden'
  }}>
    {project.description || 'No description'}
  </div>

  {/* Divider */}
  <div style={{ borderTop:'1px solid var(--border)', marginBottom:12 }}/>

  {/* Footer */}
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
      {project.entity_count ?? 0} entities · {project.document_count ?? 0} docs · {project.relationship_count ?? 0} edges
    </span>
    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
      {formatDate(project.created_at)}
    </span>
  </div>
</div>
```

Add CSS for the card menu button hover:
```css
.card:hover .card-menu-btn,
div:hover > .card-menu-btn { opacity: 1 !important; }
```

### New Project modal
Trigger from "New Project" button. Wire submit to existing `POST /api/projects/` call.
```jsx
{/* Backdrop */}
<div style={{
  position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
  display:'flex', alignItems:'center', justifyContent:'center', zIndex:200
}}>
  {/* Modal */}
  <div style={{
    background:'var(--bg2)', border:'1px solid var(--border2)',
    borderRadius:16, padding:32, width:'90%', maxWidth:480,
    animation:'fadeUp .3s forwards'
  }}>
    <h3 style={{ fontFamily:'var(--serif)', fontSize:24, color:'#fff', marginBottom:24 }}>
      Create a new project
    </h3>

    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:6 }}>
        Project name *
      </label>
      <input
        placeholder="e.g. AI for Good Uzbekistan Hackathon"
        value={name}
        onChange={/* existing handler */}
      />
    </div>

    <div style={{ marginBottom:28 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:6 }}>
        Description (optional)
      </label>
      <textarea
        rows={3}
        placeholder="Brief description of what this project is about"
        value={description}
        onChange={/* existing handler */}
        style={{ resize:'vertical' }}
      />
    </div>

    <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
      <button onClick={/* close modal */} className="btn-ghost">Cancel</button>
      <button onClick={/* existing submit handler */} className="btn-primary" disabled={!name.trim()}>
        Create project
      </button>
    </div>
  </div>
</div>
```

---

## TASK 6 — CONCEPT NOTE PAGE (`/projects/{id}/setup` or equivalent)

Rewire: existing concept note save/update handler, file upload handler.

### Backend — verify these exist, add if missing:
```
GET /api/projects/{id}/
  Returns project object including concept_note field

PATCH /api/projects/{id}/
  Body: { concept_note: "string" }
  Returns: updated project

POST /api/projects/{id}/concept-note/upload/
  Body: multipart, field "file" (PDF, DOCX, TXT)
  Action: extract text, return as concept_note string for user to review
  Returns: { text: "extracted text..." }
```

### Django: add to Project model if not present
```python
concept_note            = models.TextField(blank=True, default='')
concept_note_updated_at = models.DateTimeField(null=True, blank=True)
```

### Page layout: centered single-column, max-width 680px, margin auto, padding 40px

Progress indicator (3 steps):
```jsx
<div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:40 }}>
  {['Concept Note','Upload Documents','Build Graph'].map((label, i) => (
    <React.Fragment key={label}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{
          width:32, height:32, borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--mono)', fontSize:12,
          background: i === 0 ? 'var(--accent)'
                    : i < currentStep ? 'var(--teal)' : 'transparent',
          color:       i <= 0 ? '#fff' : 'var(--text2)',
          border:      i > 0 ? '1px solid var(--border2)' : 'none',
        }}>
          {i < currentStep ? '✓' : i + 1}
        </div>
        <span style={{ fontSize:11, color: i === 0 ? 'var(--text)' : 'var(--text3)' }}>{label}</span>
      </div>
      {i < 2 && <div style={{ flex:1, height:1, background:'var(--border)', margin:'0 8px', marginBottom:20 }}/>}
    </React.Fragment>
  ))}
</div>
```

Textarea (wire to existing state + save handler):
```jsx
<textarea
  value={conceptNote}
  onChange={/* existing handler */}
  onBlur={/* existing autosave handler (debounced 1s) */}
  rows={12}
  placeholder={`Describe your project objectives and the stakeholder landscape you want to map.\n\nExample: "This project maps the stakeholder ecosystem for the AI for Good Uzbekistan Hackathon (March 2025). We are interested in: organizations involved in AI and tech policy, government ministries, international development organizations, and individual experts in the region."`}
  style={{ resize:'vertical', minHeight:240, lineHeight:1.6 }}
/>
```

Character count (below textarea, right-aligned):
```jsx
<div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', textAlign:'right', marginTop:6 }}>
  {conceptNote.length} chars · recommended 200–500
</div>
```

Upload alternative (wire to existing file upload handler):
```jsx
<div
  style={{
    border:'1.5px dashed var(--border2)', borderRadius:12,
    padding:'24px', textAlign:'center', cursor:'pointer',
    transition:'border-color .2s, background .2s', marginTop:16
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-soft)'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='transparent'; }}
  onClick={/* trigger existing file input */}
>
  <div style={{ fontSize:13, color:'var(--text2)', marginBottom:4 }}>
    Or upload a concept note file
  </div>
  <div style={{ fontSize:11, color:'var(--text3)' }}>PDF, DOCX, TXT — text will be extracted for review</div>
</div>
```

Actions:
```jsx
<div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:32 }}>
  <button onClick={/* skip */} className="btn-ghost">Skip for now</button>
  <button
    onClick={/* existing save + navigate handler */}
    className="btn-primary"
    disabled={conceptNote.length < 50}
  >
    Save & continue →
  </button>
</div>
```

---

## TASK 7 — DOCUMENT UPLOAD PAGE (`/projects/{id}/documents`)

Rewire: existing upload handler, document list fetch, status polling.

### Backend — verify these exist, add if missing:
```
GET /api/projects/{id}/documents/
  Returns: [{ id, filename, file_size, file_type, status, progress_pct,
               entity_count, uploaded_at, processed_at, error_message }]

POST /api/projects/{id}/documents/upload/
  Body: multipart, field "file"
  Accepts: .pdf .docx .txt up to 50MB
  Returns: { id, filename, file_size, status: "queued" }
  Side effect: enqueues Celery processing task

DELETE /api/projects/{id}/documents/{doc_id}/
  Returns: 204

GET /api/projects/{id}/documents/{doc_id}/status/
  Returns: { status, progress_pct, entity_count, error_message }
  Used for polling every 3s while processing
```

### Django Document model — add if fields missing:
```python
progress_pct  = models.IntegerField(default=0)
entity_count  = models.IntegerField(default=0)
error_message = models.TextField(blank=True)
processed_at  = models.DateTimeField(null=True, blank=True)
```

### Upload zone (wire to existing upload handler)
```jsx
<div
  onDrop={/* existing drop handler */}
  onDragOver={e => e.preventDefault()}
  onClick={/* trigger file input */}
  style={{
    border:'1.5px dashed var(--border2)', borderRadius:14,
    padding:'48px 24px', textAlign:'center', cursor:'pointer',
    transition:'border-color .2s, background .2s', marginBottom:24
  }}
>
  <div style={{
    width:40, height:40, borderRadius:10, margin:'0 auto 12px',
    background:'var(--accent-soft)', border:'1px solid rgba(61,111,255,0.25)',
    display:'flex', alignItems:'center', justifyContent:'center'
  }}>
    {/* upload arrow SVG */}
  </div>
  <div style={{ fontSize:15, fontWeight:500, color:'var(--text)', marginBottom:4 }}>
    Upload project documents
  </div>
  <div style={{ fontSize:12, color:'var(--text3)' }}>
    PDF, DOCX, TXT — up to 50MB each · drag & drop or click to browse
  </div>
  <input type="file" multiple accept=".pdf,.docx,.txt" style={{ display:'none' }} ref={fileInputRef} onChange={/* existing handler */}/>
</div>
```

### Document list (map over existing documents array)
```jsx
{documents.map(doc => (
  <div key={doc.id} style={{
    background:'var(--bg2)', border:'1px solid var(--border)',
    borderRadius:8, padding:'12px 16px',
    display:'flex', alignItems:'center', gap:12, marginBottom:8
  }}>
    {/* File type icon */}
    <div style={{
      width:32, height:32, borderRadius:7, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
      background: doc.file_type === 'pdf' ? 'var(--coral-soft)'
                : doc.file_type === 'docx' ? 'var(--accent-soft)'
                : 'var(--amber-soft)'
    }}>
      {doc.file_type === 'pdf' ? '📄' : doc.file_type === 'docx' ? '📘' : '📝'}
    </div>

    {/* Name + meta */}
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:2 }}>
        {doc.filename}
      </div>
      <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
        {formatFileSize(doc.file_size)} · {doc.file_type?.toUpperCase()}
        {doc.status === 'processed' && ` · ${doc.entity_count} entities extracted`}
      </div>
      {/* Progress bar — show while processing */}
      {doc.status === 'processing' && (
        <div style={{ height:3, background:'var(--border2)', borderRadius:2, marginTop:6 }}>
          <div style={{
            height:'100%', borderRadius:2, background:'var(--accent)',
            width:`${doc.progress_pct ?? 0}%`, transition:'width .5s'
          }}/>
        </div>
      )}
      {/* Error message */}
      {doc.status === 'error' && (
        <div style={{ fontSize:11, color:'var(--coral)', marginTop:4 }}>
          {doc.error_message || 'Processing failed'}
        </div>
      )}
    </div>

    {/* Status badge */}
    <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
      {doc.status === 'processing' ? `${doc.progress_pct ?? 0}%` : doc.status}
    </span>

    {/* Delete button — wire to existing delete handler */}
    <button
      onClick={e => { e.stopPropagation(); /* existing delete with confirm */ }}
      style={{ background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', padding:4 }}
    >✕</button>
  </div>
))}
```

Polling: call `GET /api/projects/{id}/documents/{doc_id}/status/` every 3s for any document with status `queued` or `processing`. Update document in local state. Stop polling when status is `processed` or `error`.

### Bottom action
```jsx
<div style={{ marginTop:32, display:'flex', justifyContent:'flex-end' }}>
  <button
    onClick={/* navigate to map page */}
    className="btn-primary btn-primary-lg"
    disabled={!documents.some(d => d.status === 'processed')}
  >
    Build the graph →
  </button>
</div>
```

---

## TASK 8 — PROJECT MAP PAGE (`/projects/{id}/map`)

Rewire: existing graph data fetch, existing D3/vis/sigma graph instance, existing entity panel, existing filter state, existing NL query handler.

### Backend — verify these exist, add if missing:
```
GET /api/projects/{id}/graph/
  Returns: {
    nodes: [{ id, canonical_name, entity_type, color_hex, shape,
               connection_count, mention_count, confidence_score }],
    edges: [{ id, source, target, relationship_type, relationship_label,
               weight, is_directional }]
  }

POST /api/projects/{id}/query/
  Body: { question: "string" }
  Returns: { answer: "string", relevant_entity_ids: ["uuid",...] }

PATCH /api/projects/{id}/graph/layout/
  Body: { positions: [{ entity_id, x, y }] }
  Returns: 200
```

If `color_hex` and `shape` are not included in the graph response, add them by joining through the `EntityType` model in the serializer. Use `ENTITY_TYPE_MAP` constants as fallback on the frontend.

### Page shell
Full-screen, no padding:
```
┌─────────────────────────────────────────────────┐
│ NAV (52px)                                      │
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │ PROJECT BANNER (54px)                │
│ (220px)  ├──────────────────────────────────────┤
│          │ TAB BAR (52px)                       │
│          ├──────────────────────────────────────┤
│          │ GRAPH CANVAS (flex:1, relative)      │
└──────────┴──────────────────────────────────────┘
```

### Project banner
```jsx
<div style={{
  height:54, background:'var(--bg2)', borderBottom:'1px solid var(--border)',
  display:'flex', alignItems:'center', padding:'0 24px', gap:16, flexShrink:0
}}>
  <div>
    <div style={{ fontFamily:'var(--serif)', fontSize:18, color:'#fff' }}>
      {project.name}  {/* from existing project object */}
    </div>
    <div style={{ display:'flex', gap:12, marginTop:2 }}>
      {/* read from existing project data */}
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
        Updated {formatRelativeTime(project.updated_at)}
      </span>
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
        {project.document_count} documents
      </span>
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
        {project.entity_count} entities · {project.relationship_count} edges
      </span>
    </div>
  </div>
  <span className={`badge ${getStatusBadgeClass(project.status)}`} style={{ marginLeft:'auto' }}>
    {project.status}
  </span>
</div>
```

### Tab bar
```jsx
<div style={{
  height:52, borderBottom:'1px solid var(--border)',
  display:'flex', alignItems:'center', padding:'0 24px', gap:2, flexShrink:0
}}>
  {['Knowledge Graph','Documents','Entities'].map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        padding:'6px 14px', borderRadius:6, fontSize:13, fontWeight:400,
        border: activeTab === tab ? '1px solid var(--border2)' : '1px solid transparent',
        background: activeTab === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: activeTab === tab ? 'var(--text)' : 'var(--text2)',
        cursor:'pointer', transition:'all .15s'
      }}
    >
      {tab}
    </button>
  ))}
  <div style={{ flex:1 }}/>
  {/* Existing filter / layout / export buttons rewired to btn-ghost */}
</div>
```

### Graph canvas overlay components

**Toolbar (left, absolute):**
```jsx
<div style={{
  position:'absolute', top:16, left:16, zIndex:10,
  background:'var(--bg2)', border:'1px solid var(--border)',
  borderRadius:12, padding:8, display:'flex', flexDirection:'column', gap:4
}}>
  {/* Icon buttons 34x34px each */}
  {/* Wire each to existing graph handler: select, pan, zoom-in, zoom-out, fit, focus-mode */}
</div>
```

**Concept note chip (absolute, top-left next to toolbar):**
```jsx
<div style={{
  position:'absolute', top:16, left:72, zIndex:10,
  background:'var(--bg2)', border:'1px solid var(--border2)',
  borderRadius:20, padding:'6px 14px',
  display:'flex', alignItems:'center', gap:8,
  fontSize:12, color:'var(--text2)', cursor:'pointer', maxWidth:280
}}>
  <svg>/* star/seed icon in var(--accent) */</svg>
  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
    {project.concept_note?.slice(0, 40)}…
  </span>
</div>
```

**Filter panel (absolute, top-right):**
```jsx
<div style={{
  position:'absolute', top:16, right:16, zIndex:10,
  background:'var(--bg2)', border:'1px solid var(--border)',
  borderRadius:14, padding:16, width:220
}}>
  {/* Section: Entity Types */}
  {/* Map over unique entity types in graph nodes */}
  {/* Toggle checkbox per type: wire to existing filter state */}
  {/* Each row: checkbox + colored dot + type name + count */}

  <div style={{ borderTop:'1px solid var(--border)', margin:'12px 0' }}/>

  {/* Section: Edge Strength */}
  {/* Strong / Medium / Weak with proportion bars */}
</div>
```

**NL query bar (absolute, bottom-center):**
```jsx
<div style={{
  position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)',
  width:520, background:'var(--bg2)', border:'1px solid var(--border2)',
  borderRadius:30, display:'flex', alignItems:'center',
  padding:'0 16px', gap:10, zIndex:10
}}>
  {/* search icon */}
  <input
    placeholder="Ask anything about this network… e.g. Who has relationships with UNDP?"
    onKeyDown={e => { if(e.key === 'Enter' && e.currentTarget.value.trim()) handleNLQuery(e.currentTarget.value); }}
    style={{ flex:1, background:'transparent', border:'none', outline:'none', padding:'13px 0', fontSize:14, color:'var(--text)' }}
  />
  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 5px' }}>
    ↵ ask
  </span>
</div>
```

Wire `handleNLQuery` to existing `POST /api/projects/{id}/query/` call. On response:
1. Show answer in panel above query bar
2. Highlight `relevant_entity_ids` nodes with pulse animation on the graph

**NL query result panel (absolute, above query bar, shown after query):**
```jsx
<div style={{
  position:'absolute', bottom:100, left:'50%', transform:'translateX(-50%)',
  width:520, background:'var(--bg2)', border:'1px solid var(--border2)',
  borderRadius:12, padding:16, zIndex:10
}}>
  <div style={{ fontSize:14, color:'var(--text)', lineHeight:1.6, marginBottom:10 }}>
    {queryAnswer}
  </div>
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
      {relevantEntityIds.length} entities highlighted on map
    </span>
    <button onClick={clearQuery} style={{ background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:12 }}>
      Dismiss
    </button>
  </div>
</div>
```

**Status bar (absolute, bottom):**
```jsx
<div style={{
  position:'absolute', bottom:0, left:0, right:0, height:26,
  background:'var(--bg2)', borderTop:'1px solid var(--border)',
  display:'flex', alignItems:'center', padding:'0 16px', gap:16, zIndex:10
}}>
  <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>
    <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--teal)', animation:'pulse 2s infinite' }}/>
    Graph ready
  </div>
  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>{nodeCount} nodes</span>
  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>{edgeCount} edges</span>
  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }} id="zoom-level">100%</span>
  <div style={{ flex:1 }}/>
  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>
    {currentLLMProvider}  {/* from existing env/config */}
  </span>
</div>
```

### Graph node + edge visual rewire
Rewire existing graph rendering (D3 or otherwise) to apply:

**Nodes:**
- Shape determined by `node.shape` (from API) or fallback from `ENTITY_TYPE_MAP[node.entity_type].shape`
- Fill color from `node.color_hex` or fallback from `ENTITY_TYPE_MAP[node.entity_type].color`
- Base radius: `Math.max(9, Math.min(28, 8 + Math.sqrt(node.connection_count) * 3))`
- Halo: same color, opacity 0.07, radius + 8px
- Inner dot: `rgba(255,255,255,0.55)`, radius × 0.2
- Label: system sans 10.5px `var(--text2)` below node
- On hover: show tooltip (name + type)
- On click: open entity panel (wire to existing entity detail fetch)

**Edges:**
- Curved (quadratic bezier, control point offset from midpoint)
- Stroke color: source node color, opacity `0.12 + weight * 0.2`
- Stroke width: `0.5 + weight * 1.5`
- Label at midpoint: DM Mono 9px `var(--text3)` showing relationship type label
- Directional edges: arrowhead marker

---

## TASK 9 — ENTITY PANEL + ENTITY DETAIL PAGE

Rewire: existing entity detail API fetch, existing navigate-to-entity handler.

### Backend — verify these exist, add if missing:
```
GET /api/projects/{id}/entities/{entity_id}/
  Returns: {
    id, canonical_name, entity_type, description,
    confidence_score, mention_count, aliases,
    relationships: [{
      id,
      related_entity: { id, canonical_name, entity_type, color_hex },
      relationship_type, relationship_label,
      direction,   // "outgoing" | "incoming" | "bidirectional"
      weight,
      source_documents: [{ id, filename, excerpt }]
    }],
    source_documents: [{ id, filename, file_size, file_type,
                          mention_count, excerpts: ["string"] }],
    llm_summary: "string",
    global_presence: [{ project_id, project_name, connection_count, mention_count }]
  }
```

### Backend — add LLM summary generation if missing:
```python
# In the entity detail view, generate and cache llm_summary:
def get_llm_summary(entity, project):
    # Check cache (store on ProjectEntity model)
    pe = ProjectEntity.objects.get(project=project, entity=entity)
    if pe.llm_summary:
        return pe.llm_summary

    # Build prompt
    rels = Relationship.objects.filter(project=project).filter(
        Q(source_entity=entity) | Q(target_entity=entity)
    ).select_related('source_entity','target_entity','relationship_type')

    rel_lines = [
        f"- {r.source_entity.canonical_name} {r.relationship_type.name} {r.target_entity.canonical_name}"
        for r in rels[:20]
    ]
    prompt = f"""Project context: {project.concept_note}

Entity: {entity.canonical_name} ({entity.entity_type.name})
Relationships in this project:
{chr(10).join(rel_lines)}

Write 2-3 sentences summarizing this entity's role in the project context above.
Be specific. Do not invent information not supported by the relationships listed."""

    provider = get_llm_provider()
    summary = provider.complete_with_retry(prompt).content

    # Cache it
    pe.llm_summary = summary
    pe.save(update_fields=['llm_summary'])
    return summary
```

Add `llm_summary` field to `ProjectEntity` model if missing:
```python
llm_summary = models.TextField(blank=True)
```

### Panel component (slide-in, used on map page)
```jsx
<div style={{
  position:'absolute', right:0, top:0, bottom:0, width:360,
  background:'var(--bg2)', borderLeft:'1px solid var(--border)',
  display:'flex', flexDirection:'column', overflow:'hidden',
  transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
  transition:'transform .3s cubic-bezier(0.16,1,0.3,1)',
  zIndex:20
}}>
  {/* Header */}
  <div style={{ padding:20, borderBottom:'1px solid var(--border)', flexShrink:0, position:'relative' }}>
    {/* Type badge */}
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:entity?.color_hex }}/>
      <span style={{
        fontFamily:'var(--mono)', fontSize:10, letterSpacing:'0.08em',
        textTransform:'uppercase', color:'var(--text3)'
      }}>
        {entity?.entity_type}
      </span>
    </div>

    {/* Entity name */}
    <div style={{ fontFamily:'var(--serif)', fontSize:22, color:'#fff', lineHeight:1.2, marginBottom:8 }}>
      {entity?.canonical_name}
    </div>

    {/* LLM summary */}
    <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
      {entity?.llm_summary || entity?.description}
    </div>

    {/* Close button */}
    <button
      onClick={closePanel}
      style={{
        position:'absolute', top:16, right:16, width:28, height:28,
        border:'1px solid var(--border)', borderRadius:'50%',
        background:'transparent', color:'var(--text2)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'
      }}
    >✕</button>
  </div>

  {/* Scrollable body */}
  <div style={{ flex:1, overflowY:'auto', padding:20 }}>

    {/* Stats */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24 }}>
      {[
        { v: entity?.relationships?.length ?? 0, l: 'Connections' },
        { v: entity?.source_documents?.length ?? 0, l: 'Documents' },
        { v: entity?.mention_count ?? 0, l: 'Mentions' },
        { v: entity?.confidence_score?.toFixed(2) ?? '—', l: 'Confidence' },
      ].map(s => (
        <div key={s.l} style={{
          background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:8, padding:12
        }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:20, color:'#fff', lineHeight:1, marginBottom:4 }}>{s.v}</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{s.l}</div>
        </div>
      ))}
    </div>

    {/* Relationships */}
    <div className="section-label">Relationships</div>
    {entity?.relationships?.map(rel => (
      <div key={rel.id} style={{
        display:'flex', alignItems:'flex-start', gap:10,
        padding:'10px 0', borderBottom:'1px solid var(--border)', cursor:'pointer'
      }}
      onClick={() => navigateToEntity(rel.related_entity.id)}
      >
        <div style={{ width:6, height:6, borderRadius:'50%', background:rel.related_entity.color_hex, marginTop:5, flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:2 }}>
            {rel.related_entity.canonical_name}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{rel.relationship_label}</div>
          {rel.source_documents?.[0]?.excerpt && (
            <div style={{ fontSize:11, color:'var(--text2)', marginTop:4, fontStyle:'italic', lineHeight:1.5 }}>
              "{rel.source_documents[0].excerpt.slice(0,100)}…"
            </div>
          )}
        </div>
        <span style={{
          fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)',
          background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:4, padding:'2px 6px', flexShrink:0
        }}>
          {rel.weight?.toFixed(2)}
        </span>
      </div>
    ))}

    {/* Source documents */}
    <div className="section-label" style={{ marginTop:24 }}>Source documents</div>
    {entity?.source_documents?.map(doc => (
      <div key={doc.id} style={{
        background:'var(--bg3)', border:'1px solid var(--border)',
        borderRadius:8, padding:12, marginBottom:8
      }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:4 }}>{doc.filename}</div>
        <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)', marginBottom:6 }}>
          {doc.mention_count} mentions
        </div>
        {doc.excerpts?.slice(0,2).map((ex, i) => (
          <div key={i} style={{
            fontSize:11, color:'var(--text2)', lineHeight:1.5,
            fontStyle:'italic', borderLeft:'2px solid var(--border2)',
            paddingLeft:8, marginBottom:4
          }}>
            "{ex.slice(0,120)}…"
          </div>
        ))}
      </div>
    ))}

  </div>

  {/* Footer — link to full page */}
  <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
    <a href={`/projects/${projectId}/entities/${entity?.id}`} className="btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12 }}>
      View full profile →
    </a>
  </div>
</div>
```

### Full entity detail page (`/projects/{id}/entities/{entity_id}`)
Same data, expanded two-column layout: main column (relationships, local graph, source docs, tags) + right sidebar (quick facts, global presence, nearby entities). See Task 9 panel above for all component details — expand to full page width with the sidebar shown.

Local graph (1-hop, static SVG, same visual style):
- Center node: larger, same color, halo
- Connected nodes: smaller, positioned radially
- Edges: same curved style
- All nodes clickable → navigate to that entity

Global presence sidebar section:
```jsx
{entity?.global_presence?.map(gp => (
  <div key={gp.project_id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
    <span style={{ fontSize:12, color:'var(--text2)', width:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
      {gp.project_name}
    </span>
    <div style={{ flex:1, height:4, background:'var(--border2)', borderRadius:2 }}>
      <div style={{ height:'100%', borderRadius:2, background:'var(--accent)', width:`${(gp.connection_count / maxConnections) * 100}%` }}/>
    </div>
    <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>{gp.connection_count}</span>
  </div>
))}
```

---

## TASK 10 — CELERY PROCESSING PIPELINE (backend only)

Verify the following Celery task exists and is wired correctly. Add any missing steps.

```python
# tasks.py
@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str, project_id: str):
    """
    Full document processing pipeline.
    Updates document.progress_pct throughout so the frontend polling sees progress.
    """
    doc = Document.objects.get(id=document_id)
    project = Project.objects.get(id=project_id)
    doc.status = 'processing'
    doc.progress_pct = 0
    doc.save(update_fields=['status','progress_pct'])

    try:
        # Step 1 — Extract text (10%)
        raw_text = extract_text(doc)  # pdfplumber / python-docx / direct read
        doc.raw_text = raw_text
        doc.progress_pct = 10
        doc.save(update_fields=['raw_text','progress_pct'])

        # Step 2 — Chunk (20%)
        chunks = chunk_text(raw_text, chunk_size=800, overlap=100)
        doc.chunk_count = len(chunks)
        doc.progress_pct = 20
        doc.save(update_fields=['chunk_count','progress_pct'])

        # Step 3 — Extract entities + relationships per chunk
        entity_type_list = list(EntityType.objects.filter(is_active=True).values_list('name', flat=True))
        rel_type_list    = list(RelationshipType.objects.filter(is_active=True).values_list('name', flat=True))
        provider = get_llm_provider()

        for i, chunk_text_content in enumerate(chunks):
            prompt = build_extraction_prompt(
                concept_note=project.concept_note,
                entity_types=entity_type_list,
                relationship_types=rel_type_list,
                chunk_text=chunk_text_content
            )
            try:
                response = provider.complete_with_retry(prompt, json_mode=True)
                parsed = parse_extraction_response(response.content)
                save_entities_and_relationships(parsed, project, doc)
            except Exception as e:
                # Log but continue — one bad chunk should not fail the whole doc
                logger.warning(f"Chunk {i} extraction failed: {e}")

            doc.progress_pct = 20 + int((i + 1) / len(chunks) * 70)
            doc.save(update_fields=['progress_pct'])

        # Step 4 — Post-process (90% → 100%)
        remove_orphan_entities(project)  # entities with no relationships
        doc.entity_count = count_entities_from_doc(doc, project)
        doc.status = 'processed'
        doc.progress_pct = 100
        doc.processed_at = timezone.now()
        doc.save(update_fields=['status','progress_pct','entity_count','processed_at'])

        # Update project status
        project.status = 'ready'
        project.save(update_fields=['status','updated_at'])

    except Exception as exc:
        doc.status = 'error'
        doc.error_message = str(exc)
        doc.save(update_fields=['status','error_message'])
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

---

## TASK 11 — DEDUPLICATION (backend, add if missing)

```python
# entities/deduplication.py
from rapidfuzz import fuzz

SIMILARITY_THRESHOLD = 0.85

def resolve_entity(name: str, entity_type_id: int) -> 'Entity':
    """Returns existing matched entity or creates new one."""

    # 1. Exact match on canonical name
    entity = Entity.objects.filter(canonical_name__iexact=name, entity_type_id=entity_type_id).first()
    if entity:
        return entity

    # 2. Exact match on any alias
    alias = EntityAlias.objects.filter(alias__iexact=name, entity__entity_type_id=entity_type_id).first()
    if alias:
        return alias.entity

    # 3. Fuzzy match
    candidates = Entity.objects.filter(entity_type_id=entity_type_id)
    best, best_score = None, 0.0
    for candidate in candidates:
        all_names = [candidate.canonical_name] + list(candidate.aliases.values_list('alias', flat=True))
        for cname in all_names:
            score = max(
                fuzz.ratio(name.lower(), cname.lower()) / 100,
                fuzz.token_sort_ratio(name.lower(), cname.lower()) / 100
            )
            if score > best_score:
                best_score = score
                best = candidate

    if best_score >= SIMILARITY_THRESHOLD and best:
        EntityAlias.objects.get_or_create(entity=best, alias=name)
        if len(name) > len(best.canonical_name):
            best.canonical_name = name
            best.save(update_fields=['canonical_name'])
        return best

    # 4. Create new
    return Entity.objects.create(canonical_name=name, entity_type_id=entity_type_id)
```

---

## TASK 12 — LLM PROVIDER ABSTRACTION (backend, add if missing)

```python
# llm/provider.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class LLMResponse:
    content: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str

class BaseLLMProvider(ABC):
    @abstractmethod
    def complete(self, prompt: str, system: str = "", json_mode: bool = False) -> LLMResponse:
        pass

    def complete_with_retry(self, prompt: str, **kwargs) -> LLMResponse:
        import time
        for attempt in range(3):
            try:
                return self.complete(prompt, **kwargs)
            except Exception as e:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)

# llm/factory.py
def get_llm_provider() -> BaseLLMProvider:
    import os
    provider = os.environ.get('LLM_PROVIDER', 'groq').lower()
    model    = os.environ.get('LLM_MODEL', 'llama-3.3-70b-versatile')
    if provider == 'groq':
        from .groq_provider import GroqProvider
        return GroqProvider(api_key=os.environ['GROQ_API_KEY'], model=model)
    elif provider == 'openai':
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=os.environ['OPENAI_API_KEY'], model=model)
    elif provider == 'azure':
        from .azure_provider import AzureOpenAIProvider
        return AzureOpenAIProvider(
            endpoint=os.environ['AZURE_OPENAI_ENDPOINT'],
            api_key=os.environ['AZURE_OPENAI_API_KEY'],
            deployment=os.environ['AZURE_OPENAI_DEPLOYMENT'],
        )
    elif provider == 'gemini':
        from .gemini_provider import GeminiProvider
        return GeminiProvider(api_key=os.environ['GEMINI_API_KEY'], model=model)
    raise ValueError(f'Unknown LLM_PROVIDER: {provider}')
```

---

## TASK 13 — EXTRACTION PROMPT (backend, version-controlled)

Create `prompts/extract_entities_v1.txt`:
```
SYSTEM:
You are an expert entity and relationship extractor for stakeholder analysis.
Extract ONLY entities and relationships relevant to the project context provided.
Respond ONLY with valid JSON. No explanation, no markdown, no preamble.

USER:
PROJECT CONTEXT (concept note):
{concept_note}

ENTITY TYPES TO EXTRACT:
{entity_types_list}

RELATIONSHIP TYPES:
{relationship_types_list}

TEXT CHUNK:
{chunk_text}

Return JSON in exactly this format:
{
  "entities": [
    {
      "name": "string (prefer full name over acronym)",
      "type": "string (must match entity types above)",
      "description": "1-2 sentences based only on the text",
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "source": "entity name",
      "target": "entity name",
      "type": "string (must match relationship types above)",
      "weight": 0.0-1.0,
      "directional": true/false,
      "evidence": "quote or paraphrase from text"
    }
  ]
}

Rules:
- Only extract entities relevant to the concept note
- Only extract relationships where both entities appear in the entities array above
- Do not invent information
- Prefer full names: "United Nations Development Programme" over "UNDP"
- Omit entities with no relevant relationships
```

---

## IMPLEMENTATION ORDER

Complete tasks in this exact sequence:

```
0  → Global design system (CSS vars, fonts, base styles, helpers)
1  → Top navigation bar component
2  → Sidebar component
3  → Landing page (all sections)
4  → Auth pages (login + register)
5  → Projects dashboard (empty state + cards)
6  → Concept note page
7  → Document upload page + polling
8  → Map page shell + overlay components
9  → Entity panel + entity detail page
10 → Celery processing pipeline (verify/add)
11 → Deduplication (verify/add)
12 → LLM provider abstraction (verify/add)
13 → Extraction prompt file (verify/add)
```

For tasks 10–13: if the implementation already exists and is functional, verify it matches the spec above and make only the missing additions. Do not rewrite working pipeline code.
