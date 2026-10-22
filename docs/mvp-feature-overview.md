# NIM Studio — MVP Feature Overview (Page by Page)

Holistic guide to what exists in the MVP today: every page, what you can do there, how pieces connect, and what is demo vs live.

---

## Product in one paragraph

**NIM Studio** is an agency content workspace for New Initiatives Marketing. Teams pick a client, generate or demo a blog (topic → keywords → research → outline → draft), review with SEO and repurpose assets, track deadlines on a calendar, manage saved drafts, and message the team via Slack — all in a branded shell with data in the browser (`localStorage`). Live AI and real Google OAuth are not required for demos; Slack and calendar can optionally hit real endpoints when env vars are set.

---

## How the product flows

```
Home Dashboard
    ├─→ Client Hub → Client Workspace → Blog Studio (wizard)
    │                                      ├─→ Review (SEO / Repurpose / Consistency)
    │                                      └─→ Editor
    ├─→ Saved Drafts (Library) ← filters by client / status
    ├─→ Content Calendar ← deadlines / .ics / sync API
    ├─→ Slack panel (beside Recent Activity)
    ├─→ Tones of Voice (Dashboard → Tones)
    └─→ Usage & Cost (Dashboard → Usage)
```

Seed clients (WBE, PowerUp Leadership, CrossCap, Function Point, PGGC) ship with calendar content and files so the workspace feels populated.

---

## Shared shell (every page)

| Feature | What it does |
|---------|----------------|
| Thin sidebar | Collapsible icon rail; state saved in browser |
| Brand | NIM logo + “NIM Studio” |
| Search | Finds blogs, clients, or opens Library with query |
| Nav | **Dashboard:** Overview, Clients, Calendar, Activity, Tones, Usage · **Blog content:** All Blogs, SEO Keywords |
| Recent clients | Up to 5 shortcuts |
| Profile | Static “Demo User / NIM EDITOR” |
| Title bar | Browser title `Page · NIM Studio` |

---

## Page-by-page features

### 1. Home / Dashboard — `/`

**Purpose:** At-a-glance ops hub for content status, deadlines, activity, and team chat.

| Section | Features |
|---------|----------|
| Header | Greeting (Good morning/afternoon/evening), notifications icon, account avatar, **+ Generate Blog** |
| KPIs | Total blogs, drafts in progress, approved, clients — each links to Library or Clients |
| Deadline board | Overdue / Due today / Upcoming; by-client chips; Export Google (`.ics`); Sync via API; link to full calendar |
| Recent Activity | Latest blog/draft events; link to full Activity |
| Slack messages | Team feed + compose/send (demo or live webhook) |
| Client performance | Per-client blogs this month, status, last update |
| Calendar preview | Current month grid with event chips → articles |

**Holistic role:** Entry point that ties generation, review status, deadlines, and Slack into one screen.

---

### 2. Client Hub — `/clients`

**Purpose:** Find or create clients and open their workspace.

| Feature | Detail |
|---------|--------|
| Search | Filter by name, website, industry, city, summary |
| Sort | Newest / oldest / name |
| Add client | Name*, website*, industry → saved in browser |
| Client cards | Swatch, industry, summary, file/draft/blog counts → workspace |

**Holistic role:** CRM-lite list that feeds every client-scoped flow.

---

### 3. Client Workspace — `/clients/:clientId`

**Purpose:** Per-client “Drive” and launch pad for Blog Studio.

| Feature | Detail |
|---------|--------|
| Simulated Drive | Folders, search, file grid, preview (seed + uploaded files) |
| Upload & save | PDF, docs, text, CSV/XLSX, etc. → localStorage |
| Generate Blog | Opens wizard |
| Library link | Filtered saved drafts for this client |

**Holistic role:** Where client context (files, prior content) lives before generation.

---

### 4. Blog Studio / Generate — `/clients/:clientId/generate`

**Purpose:** Guided blog creation.

#### Steps

| Step | Features |
|------|----------|
| **1 · Topic & audience** | Three modes (below); tone of voice; word target (incl. custom / 2000+); topic; audience; notes |
| **2 · Keywords** | Comma list; first = primary; **Suggest keywords** (local heuristic) |
| **3 · Research** | Editable simulated research pack |
| **4 · Outline** | Structured sections (heading, points, evidence, transitions); **Approve outline** (required before draft) |
| **5 · Draft** | Preview sections; open Editor or Review |

#### Topic modes

| Mode | User brings | System does |
|------|-------------|-------------|
| Manual Topic | Exact topic/title | Uses it as the subject |
| Describe Idea | Rough notes / angles | Builds from notes |
| Auto Generate | Little | Proposes topic from client context |

**Holistic role:** Core content production pipeline of the MVP.

---

### 5. Review / Reader — `/clients/:clientId/blog/:blogId`

**Purpose:** Read the article and run post-generation tools (no regenerate here).

| Area | Features |
|------|----------|
| Toolbar | Save draft, Edit, Export (text bundle), Approve |
| Document | Title, body/sections, SEO pills, meta |
| Tab · Consistency | Outline-vs-body checks |
| Tab · SEO | Title, meta, checklist, internal links when present |
| Tab · Repurpose | Suggested FAQs, LinkedIn post (copy), featured image brief |
| Tab · Context | Client, audience, topic, tone, status dropdown, versions |

**Holistic role:** QA + packaging for publish / social / SEO.

---

### 6. Blog Editor — `/clients/:clientId/blog/:blogId/edit`

**Purpose:** Refine the saved draft in a document-style canvas.

| Feature | Detail |
|---------|--------|
| Ribbon | Undo/redo, bold/italic/underline, font size, H2, list, align |
| Fields | Title + editable body |
| Sidebar | Status, phase, outline approval, SEO title/meta, version count |
| Save | Save draft; Save & review (returns to reader) |
| Concurrency | `generationToken` guards stale overwrites |

**Holistic role:** Human polish after generate / demo.

---

### 7. Saved Drafts (Library) — `/library`

**Purpose:** All generated blogs (+ legacy drafts) in one filterable list.

| Feature | Detail |
|---------|--------|
| Search | Titles and copy |
| **All clients** | Dropdown + **type-to-search** client names |
| Status | All / Draft / In Review / Approved |
| Rows | Excerpt, client swatch, inline status change |
| Open | Blog → Review; legacy draft → Draft page |

**Holistic role:** Archive and triage across the roster.

---

### 8. Legacy draft detail — `/library/:draftId`

**Purpose:** Edit older “content kit” drafts (local template regenerate).

| Feature | Detail |
|---------|--------|
| Editor | Title, body, status, copy, regenerate / undo |
| Badge | Mock generation · local template |

**Holistic role:** Backward-compatible drafts; primary path is Blog Studio.

---

### 9. Content Calendar — `/calendar`

**Purpose:** Plan and see publish/review dates across clients.

| Feature | Detail |
|---------|--------|
| Month nav | Prev / Today / Next |
| Summary cards | Past / Today / Upcoming (filter focus) |
| Grid | Colored event chips → articles |
| Buckets | Lists for past, today, upcoming |
| Export | Google Calendar `.ics` |
| Sync API | Posts deadlines to demo API (dashboard board updates) |

**Holistic role:** Time dimension of the same blog records as the deadline board.

---

### 10. Tones of Voice — `/tones` (Dashboard → Tones)

**Purpose:** Manage voice profiles used in the wizard tone dropdown.

| Feature | Detail |
|---------|--------|
| CRUD | Create, edit, delete (keep ≥1), reset defaults |
| Fields | Name, summary, traits, sample |

**Holistic role:** Brand voice control for generation.

---

### 11. Activity — `/activity`

**Purpose:** Full chronological feed (dashboard shows a slice).

| Feature | Detail |
|---------|--------|
| Feed | Blogs, drafts, simulated usage events |
| Links | Blog rows → Review; client name → Workspace |

**Holistic role:** Audit trail of studio work.

---

### 12. Usage & Cost — `/usage` (Dashboard → Usage)

**Purpose:** Simulated spend dashboard for demos.

| Feature | Detail |
|---------|--------|
| Stats | Total, month, LLM / SEO / research splits |
| Chart | Daily / weekly / monthly grain |
| Table | Per-client costs from static demo data |

**Holistic role:** Pitch/ops visual only — not live billing.

---

### 13. SEO Keywords — `/seo` (Blog content → SEO Keywords)

**Purpose:** Aggregate keywords across blogs; see which clients/articles use them.

| Feature | Detail |
|---------|--------|
| Search / client filter | Narrow keyword cards |
| Cards | Use count, clients, article links |

**Holistic role:** Cross-client SEO discovery (reachable by URL).

---

### 14. Not found — `*`

Back to overview; unknown paths land here.

---

## Cross-cutting feature map

| Capability | Where it shows up | Notes |
|------------|-------------------|--------|
| Brand palette & glass flashcards | All cards/panels | Slate lead; orange sparse; gold soft accents |
| Searchable dropdowns | Library clients, wizard, filters | Type to filter options |
| Blog as source of truth | Wizard, Review, Editor, Calendar, Deadlines, Library | One article record with outline, versions, SEO, repurpose fields |
| Deadlines | Dashboard board + Calendar | Same timing model (past/today/future) |
| Slack | Dashboard panel | Demo feed or `SLACK_WEBHOOK_URL` |
| Google Calendar | Board + Calendar page | `.ics` real; Sync API demo store |
| Persistence | Everywhere | `localStorage` keys for blogs, clients, tones, drafts, drive, sidebar |
| Demo User | Shell | No login |

---

## Demo vs live (MVP honesty)

| Area | Default (demo) | Optional / live |
|------|----------------|-----------------|
| Blog generation | Local templates | No external LLM wired |
| Drive | Seed files + browser uploads | Stays local |
| Calendar dates | Relative seeds + user blogs | Clock is real |
| Google sync | In-memory API + `.ics` download | `.ics` importable in Google; OAuth not built |
| Slack | Seeded + queued in app | Incoming Webhook when env set |
| Usage | Static demo numbers | Not provider billing |
| Auth | Demo User | Not built |

---

## Feature checklist (MVP whole)

- [x] Dashboard KPIs, activity, performance, calendar preview  
- [x] Deadline board + `.ics` + sync API (demo)  
- [x] Slack messages beside activity  
- [x] Client hub + workspace + simulated Drive  
- [x] Blog Studio wizard (3 topic modes, outline approve, draft)  
- [x] Review with Consistency / SEO / Repurpose / Context  
- [x] Document editor with save & review  
- [x] Saved drafts with searchable All clients filter  
- [x] Content calendar (past / today / future)  
- [x] Tones CRUD  
- [x] Activity feed + Usage demo  
- [x] Brand shell, logo, flashcard UI  
- [ ] Live LLM generation  
- [ ] Live Google Calendar OAuth  
- [ ] Two-way Slack (inbound events)  
- [ ] Real auth / multi-user  

---

## Related docs

- [`README.md`](../README.md) — run instructions and folder structure  
- [`nim-brand-document-spec.md`](./nim-brand-document-spec.md) — document / heading brand rules  
