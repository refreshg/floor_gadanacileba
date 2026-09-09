<!-- last-synced: 2026-09-09, commit: 0ec4ae5 -->
# Decisions (ADR)

### D-1: Custom single-page matrix report instead of standard Bitrix24 list views/exports
- Date: 2026-09-09
- Context: Users need project × manager matrix with floor ranges, overlap marking and per-manager totals. Standard Lists UI is row-based; Lists Excel export is flat; CRM report designer does not cover Lists; BI Builder is cloud-only. (Analysis only, not verified in instance — PRD OQ-6.)
- Decision: Build a read-only HTML report that reads list 82 via REST and pivots client-side.
- Alternatives rejected: Business Process that maintains a pivot list (heavy, still row-based); manual Excel pivot each time (stale, error-prone); Bitrix24 embedded iframe app (registration/hosting overhead, user chose plain HTML).
- Consequences: Custom code to maintain; no dependency on Bitrix UI; must track property ids in `CONFIG.props`.

### D-2: Browser-side REST calls, no backend; Vercel proxy only for hosting
- Date: 2026-09-09
- Context: Bitrix REST returns `Access-Control-Allow-Origin: *`, so a static page can call it directly. User wanted a single HTML file with live data.
- Decision: Direct calls when a local `config.js` exists; serverless proxy `api/bitrix.js` when hosted (webhook in server env).
- Alternatives rejected: Python script generating static HTML (stale data); full backend (unnecessary).
- Consequences: Two runtime modes to test; proxy is publicly callable (see D-5).

### D-3: `PROPERTY_1033` (floors sorted) is the floor source of truth
- Date: 2026-09-09
- Context: List already stores a precomputed floor list per record with odd/even applied; `PROPERTY_431/432/433/986` are inputs to that computation. `PROPERTY_986` = კი cannot be expanded without project floor count.
- Decision: Use `PROPERTY_1033`; fall back to `from..to` filtered by odd/even only when 1033 is empty.
- Alternatives rejected: Recompute from 431/432/433/986 always (would break on "all floors").
- Consequences: Depends on the portal-side process that fills 1033 (origin unknown, not in repo).

### D-4: Secrets never in repo; public GitHub repo
- Date: 2026-09-09
- Context: User asked to push to `refreshg/floor_gadanacileba`, which is public; page originally embedded the webhook.
- Decision: Webhook moved to gitignored `config.js` (local) and `BITRIX_WEBHOOK` Vercel env (hosted). `config.example.js` committed. GitHub PAT used only in push URL, removed from remote config.
- Alternatives rejected: Commit webhook (exposes CRM); make repo private (user did not request).
- Consequences: Hosted deploy needs one manual env step; local users must create `config.js`.

### D-5: Vercel page is open by link (no auth) — for now
- Date: 2026-09-09 (user answer to Q2: "იყოს ჯერ ღია")
- Context: ~20 internal users; adding auth costs time; Vercel Deployment Protection is a paid feature on Hobby for password.
- Decision: No authentication. Proxy limited to 3 read-only methods and fixed list id.
- Alternatives rejected: Vercel password protection (Pro); custom shared-code gate; Bitrix OAuth.
- Consequences: Anyone with the URL can read list 82 and the employee directory (`user.get`) via proxy. Revisit if link leaks or users grow.

### D-6: Zero build, CDN libraries, Georgian UI
- Date: 2026-09-09
- Context: Users double-click the file or open a URL; no dev tooling in the team is known.
- Decision: Vanilla JS in one file; SheetJS 0.18.5 from cdnjs; Noto Sans Georgian from Google Fonts; no `package.json` (pending PRD OQ-1).
- Alternatives rejected: React/Vite build; bundling SheetJS locally.
- Consequences: Needs internet for CDN; pure functions not unit-tested yet (PLAN M3).

### D-7: Keep admin (user 1) webhook
- Date: 2026-09-09 (user answer to Q5: "დატოვე")
- Context: Webhook belongs to user ID 1 (admin). A dedicated user with only `lists` + `user` rights would limit blast radius.
- Decision: Keep as is; recommendation recorded here and in README security section.
- Alternatives rejected: Create limited-rights user webhook (user declined for now).
- Consequences: Proxy/config leak = admin-level read of lists and users. Review date: not set (PRD OQ-5).

### D-8: Report is read-only; no writes to list 82
- Date: 2026-09-09 (user answer to Q3: "დატოვე როგორც არის")
- Context: Editing assignments from the report was considered.
- Decision: Out of scope. No `lists.element.update/add` in proxy whitelist.
- Alternatives rejected: Inline edit with write-back.
- Consequences: Fixing conflicts happens in Bitrix UI; report only surfaces them.

### D-9: Add minimal Node tooling and Conventional Commits
- Date: 2026-09-09 (user answers to Q6 "დაამატე", Q8 "მისაღებია")
- Context: No `package.json`, no tests; pure functions live inside `index.html`. User wants tooling added.
- Decision: Add `package.json` with no runtime dependencies; tests with built-in `node:test`; commit messages follow Conventional Commits. Runtime stays zero-build (D-6 unchanged).
- Alternatives rejected: Jest/Vitest (extra deps); keep zero tooling.
- Consequences: Pure functions must be extracted to a file loadable by both Node and the browser (PLAN M3).
