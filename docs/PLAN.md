<!-- last-synced: 2026-09-09, commit: 0ec4ae5 -->
# Plan — floor responsibility report

Steps marked `[x]` were implemented on 2026-09-09 before this plan existed (commits `bc828b3`, `0ec4ae5`). Open steps require approval before work starts.

## Milestone 0 — Standard-first verification
- [x] Lists module list view/filter/grouping — row-based, no pivot → recorded in SPEC Standard-first (analysis only).
- [x] Lists Excel export — flat → SPEC Standard-first (analysis only).
- [x] REST CORS check (`Origin` header → `Access-Control-Allow-Origin: *`) → SPEC Bitrix specifics.
- [ ] **Verify in running instance** (PRD OQ-6): open list 82 in crm.archi.ge UI, confirm no pivot/grouping option; confirm no Report designer/BI Builder entry for Lists. Update SPEC Standard-first "Covers it?" column with the result. Files: `docs/SPEC.md`.

## Milestone 1 — Core report (done)
- [x] Fetch layer: `callRest`, `fetchAllElements` (paging), `fetchFields`, `fetchUsers` — `index.html`.
- [x] Model: `buildModel`, `floorsFromRange`, `resolveEnums`, `formatRanges` — `index.html`.
- [x] Render: sticky header/first column/footer, cells with ranges + counts, conflicts, totals — `index.html`.
- [x] Filters: `createMultiSelect` ×2, floor search + answer line, clear — `index.html`.
- [x] Excel export via SheetJS — `index.html`.
- [x] Loading/error states, print CSS — `index.html`.

## Milestone 2 — Hosting & secrets (done)
- [x] Move webhook to `config.js` (gitignored) + `config.example.js`; `.gitignore` — root.
- [x] Vercel proxy `api/bitrix.js` with method whitelist and IBLOCK force; auto-switch in `callRest` — `api/bitrix.js`, `index.html`.
- [x] Push to `refreshg/floor_gadanacileba` `main`; verified no secrets tracked.
- [ ] Set `BITRIX_WEBHOOK` in Vercel Production env and Redeploy — **user action**, then confirm https://floor-gadanacileba.vercel.app loads (AC-11 → AC-2).

## Milestone 3 — Hardening (needs approval; risky/unknown first)
- [ ] Add `package.json` (no runtime deps, `"type": "commonjs"`, `npm test` → `node --test`) — `package.json` (approved: D-9).
- [ ] Extract pure functions (`formatRanges`, `floorsFromRange`, `buildModel`) into `lib/report.js` loaded by `index.html` via `<script>` so they are testable without a browser — `lib/report.js`, `index.html`. Keep single-file behaviour for `file://`.
- [ ] Unit tests per SPEC "Tests" table — `test/report.test.js`, `test/proxy.test.js`.
- [ ] Add backoff/retry on `QUERY_LIMIT_EXCEEDED` and HTTP 503 in `callRest` (1 retry, 1.5 s) — `index.html`.
- [ ] Proxy: basic rate limit or `Referer`/`Origin` check to reduce abuse of the open endpoint (D-5 accepted risk) — `api/bitrix.js`. Needs D-<n>.
- [ ] Headless verification script committed as `scripts/verify.ps1` (current ad-hoc command from CLAUDE.md) — `scripts/`.

## Milestone 4 — Optional UX (deferred: user confirmed v1 is final for now, 2026-09-09)
- [ ] Shareable state in URL hash (`#p=…&m=…&f=12`) — `index.html`.
- [ ] Column width toggle / compact mode for >12 visible managers — `index.html`.
- [ ] Show `PROPERTY_986` = კი as "ყველა" instead of numeric range when total floors unknown — needs data source for project floor count (IBLOCK 111?) — `index.html`, SPEC.

## Status
v1 implemented and deployed (M0 partial, M1–M2 done except Vercel env step). M3: Not started — tooling approved (D-9), remaining M3 steps and this file await approval. M4: deferred.
