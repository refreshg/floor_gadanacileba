<!-- last-synced: 2026-09-18, commit: 23c847d+apartments -->
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

### D-10: Apartment totals from CRM product catalog; extend existing webhook scope
- Date: 2026-09-18 (user answers 2026-09-15 and 2026-09-18)
- Status: **implemented 2026-09-18**. Deviation from the decision below: instead of extending the user-1 lists webhook, the user created separate webhooks with `crm` scope and explicitly instructed to read products through them ("მხოლოდ წაკითხვა"). The general proxy whitelist was therefore NOT extended; a dedicated input-less endpoint is used (D-11).
- Context: User wants the per-manager footer to show apartment count instead of floor count. List 82 has no unit data. Checked within `lists` scope: list 187 (1 record), list 140 (floor layouts, files only), list 128 "products GBE" (per-project totals by sale status, **not per floor**). Per-floor counts exist only in the CRM product catalog; list 111 links each project to a catalog section (`PROPERTY_1041` sectionID). List 159 reports ~70,082 units portal-wide.
- Decision: Read apartments from the CRM catalog. User will add `crm` (+`catalog` if available) scope to the existing user-1 webhook; URL unchanged. Proxy whitelist gets exactly one additional read-only product-list method, restricted server-side to the sections of projects present in list 82. Count all apartments regardless of sale status; show only in the manager column footer.
- Alternatives rejected: list 128 totals (no floor dimension → cannot split a project between managers); new limited-rights webhook (user chose to extend the current one); counting in cells too (user: footer only).
- Consequences: D-7 risk grows (admin webhook now also reads CRM catalog). Live per-open loading of the catalog is too slow at this size → needs aggregated + cached endpoint (design in PLAN M5). Standard-first: no standard Bitrix report joins list 82 floors with catalog units.

### D-11: Aggregated, CDN-cached apartments endpoint + shared UMD library; parallel ID-chained reads
- Date: 2026-09-18
- Context: 12,245 flats must be read to count per floor. Measured: offset paging with filters 113 s; single ID-chained batch stream ≈ 80 s (~0.3 s per page server-side); 8 parallel chains ≈ 11 s. Too slow per page open either way; ~20 viewers.
- Decision: `lib/apartments.js` (UMD, no deps) does the read + aggregation and is used by both `api/apartments.js` and the browser (local mode). Hosted: `GET /api/apartments`, no client input, `s-maxage=1800, stale-while-revalidate=86400`, `maxDuration` 60 s. Local: direct calls, `localStorage` cache 30 min. Page renders floors first, apartments fill in asynchronously and fall back to floor totals on failure.
- Alternatives rejected: whitelisting `crm.product.list` in the generic proxy (open endpoint would expose prices/buyers of 65k products); per-(project,floor) count queries (~800 commands, slower); list 128 totals (no floors).
- Consequences: apartment figures can be up to ~30 min old (timestamp shown in header as «ბინები HH:MM»); 8 concurrent batch requests hit the portal roughly twice an hour at most; two webhooks to manage.

### D-12: What counts as an apartment
- Date: 2026-09-18 (user: all statuses, footer only)
- Confirmed by user 2026-09-18 after seeing that the «ბინები» catalog section also holds parking and commercial units: "only flats are counted".
- Decision: product with `PROPERTY_383` = `ბინა`, any `PROPERTY_429` status, floor from `PROPERTY_376`; section membership decides: all 38 project sections are direct children of the top-level catalog section «ბინები» (#102). A unit is skipped only if its `PROPERTY_427` is non-empty and differs from the section's dominant name (2 units on 2026-09-18: "არქი გლდანი 4" inside the ახმეტელი A section). Amended 2026-09-18: empty names are counted (the first version wrongly dropped 139 flats of ახმეტელი C). A floor assigned to two managers counts for both.
- Alternatives rejected: `PROPERTY_450` «ტიპი» (null on some flats); matching project by name instead of section (names differ between list 111 and catalog).
- Verification: flat counts by status match the portal's own list 128 "products GBE" exactly for 20 of 26 comparable projects; the 6 differences are status drift in list 128 snapshots (e.g. იასამნები C lists 518 for sale while 272 are already sold), not type or section differences.
- Consequences: sum over managers ≠ total flats (12,384 after the fix): unassigned floors are not counted and shared floors are counted twice. Projects without `PROPERTY_1041` are excluded and flagged with `*`.
