# NIM Studio

Agency content workspace for **New Initiatives Marketing (NIM)** — client hubs, blog generation, review/SEO/repurpose, calendar & deadlines, saved drafts, and Slack messaging.

**Page-by-page features:** see [`docs/mvp-feature-overview.md`](docs/mvp-feature-overview.md) for a holistic MVP overview.

This is a **Vite + React + TypeScript** SPA. Data persists in the browser via `localStorage`. Optional Slack webhook and Google Calendar hooks run through Vite middleware (demo mode works without credentials).

---

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (often `http://localhost:5173/`).

```bash
npm run build          # typecheck + production build
npm run preview        # serve dist/
npm run test:article   # article workflow smoke test
```

Optional env (copy from `.env.example`):

| Variable | Purpose |
|----------|---------|
| `SLACK_WEBHOOK_URL` | Live Slack Incoming Webhook for homepage messages |
| `SLACK_CHANNEL` | Label shown in UI (default `#nim-studio`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Future live Google Calendar OAuth |

Without these, Slack and calendar sync run in **demo** mode.

---

## What works today

### Home / Dashboard
- Greeting, KPIs (blogs, drafts, approved, clients)
- Deadline board (overdue / today / upcoming) with Export `.ics` and Sync API
- **Recent Activity** + **Slack messages** side by side
- Client performance table + calendar preview

### Clients
- Client Hub (search, sort, add client)
- Per-client workspace (Drive files, generate entry, tones)

### Blog Studio (Generate)
- Topic modes: **Manual Topic**, **Describe Idea**, **Auto Generate**
- Keywords → research → outline (approve) → draft
- Word targets honored (including 2000+)

### Review / editor
- Reader with tabs: Review, SEO, **Repurpose** (FAQs, LinkedIn copy, image brief), Context
- Document-style editor with NIM brand heading colors

### Saved drafts (Library)
- Search drafts; **All clients** filter is a searchable dropdown
- Status filters (draft / in review / approved)

### Calendar
- Month grid with past / today / future events
- Full calendar page + Google `.ics` export; Sync API is demo-ready

### Shell / brand
- Thin light sidebar (collapsible icon rail) with NIM logo
- Brand palette: slate `#555672`, orange `#f27028` (sparse), gold `#f5bb48`, deep `#483c63`
- Shared flashcards (equal geometry + soft glass hover)
- Browser title: `NIM Studio` / `Page · NIM Studio`

---

## App structure

```
NIM MVP/
├── index.html                 # Title: NIM Studio; fonts; favicon
├── package.json
├── vite.config.ts             # React + calendar + Slack API plugins
├── .env.example
├── public/
│   ├── nim-logo.png           # Brand mark
│   └── favicon.svg
├── docs/
│   └── nim-brand-document-spec.md
├── server/                    # Vite middleware (dev API)
│   ├── calendarApiPlugin.ts   # /api/calendar/* deadlines + sync
│   └── slackApiPlugin.ts      # /api/slack/messages, /api/slack/send
└── src/
    ├── main.tsx
    ├── App.tsx                # Routes + providers
    ├── styles.css             # Design tokens + UI
    ├── types.ts
    ├── format.ts / labels.ts / usePageTitle.ts
    ├── components/
    │   ├── AppShell.tsx       # Sidebar + layout
    │   ├── DeadlineBoard.tsx
    │   ├── SlackMessages.tsx
    │   ├── DropdownSelect.tsx # Searchable option for client filter
    │   ├── DraftEditor.tsx
    │   ├── FilePreviewBody.tsx
    │   └── ui.tsx
    ├── context/               # localStorage-backed state
    │   ├── ClientsContext.tsx
    │   ├── BlogsContext.tsx
    │   ├── DraftsContext.tsx
    │   └── TonesContext.tsx
    ├── data/                  # Seeds
    │   ├── clients.ts
    │   ├── calendarSeed.ts
    │   ├── files.ts / tones.ts / topics.ts / briefs.ts / usage.ts
    ├── pages/
    │   ├── DashboardPage.tsx
    │   ├── ClientHubPage.tsx
    │   ├── WorkspacePage.tsx
    │   ├── BlogWizardPage.tsx
    │   ├── BlogReaderPage.tsx
    │   ├── BlogEditorPage.tsx
    │   ├── LibraryPage.tsx
    │   ├── CalendarPage.tsx
    │   ├── ActivityPage.tsx
    │   ├── TonesPage.tsx
    │   ├── UsagePage.tsx
    │   ├── SeoKeywordsPage.tsx  # Route exists; not in sidebar
    │   ├── DraftPage.tsx
    │   └── GeneratePage.tsx     # Legacy path helper
    └── services/
        ├── blogGenerate.ts      # Outline/draft/SEO helpers
        ├── calendar.ts / deadlines.ts / googleCalendar.ts
        ├── slack.ts
        ├── storage.ts / drive.ts / wizard.ts / generate.ts
        └── articleWorkflow.test.ts
```

---

## Routes

| Path | Page |
|------|------|
| `/` | Dashboard |
| `/clients` | Client Hub |
| `/clients/:id` | Client workspace |
| `/clients/:id/generate` | Blog Studio wizard |
| `/clients/:id/blog/:blogId` | Review / reader |
| `/clients/:id/blog/:blogId/edit` | Editor |
| `/library` | Saved drafts |
| `/library/:draftId` | Draft detail |
| `/calendar` | Content calendar |
| `/tones` | Tones of voice |
| `/activity` | Full activity |
| `/usage` | Usage & cost |
| `/seo` | SEO keywords (hidden from sidebar) |

---

## Topic modes (Generate · Step 1)

| Mode | You provide | System does |
|------|-------------|-------------|
| **Manual Topic** | Exact topic/title | Uses it for outline/draft |
| **Describe Idea** | Rough notes / angles | Builds from notes |
| **Auto Generate** | Little or nothing | Proposes topic from client context |

---

## Repurpose

On Review → **Repurpose** tab: turn a blog into FAQs, LinkedIn promo copy, and a featured-image brief.

---

## Brand tokens

```css
--brand-primary:   #555672;  /* slate — structure, CTAs */
--brand-secondary: #f27028;  /* orange — sparse accents */
--brand-accent:    #f5bb48;  /* gold — soft highlights */
--brand-deep:      #483c63;  /* section emphasis */
```

Fonts: **Sora** (headings), **Figtree** / **Carlito** (body / docs).

### Icon credits

[Filter icons](https://www.flaticon.com/free-icons/filter) created by [joalfa](https://www.flaticon.com/authors/joalfa) — Flaticon.  
[Sort icons](https://www.flaticon.com/free-icons/sort) created by [Kiraaaaa6](https://www.flaticon.com/authors/kiraaaaa6) — Flaticon.

---

## Notes / next steps (not built)

- Live Google Calendar OAuth (ICS export works; Sync API is local)
- Live LLM generation (current path is deterministic local templates)
- Two-way Slack (today: Incoming Webhook outbound + in-app feed)
