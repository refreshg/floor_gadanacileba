<!-- last-synced: 2026-09-18, commit: 23c847d+apartments -->
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
- [x] Set `BITRIX_WEBHOOK` in Vercel Production env and Redeploy (done by user; verified 2026-09-18: production renders 40/17/96) — **user action**, then confirm https://floor-gadanacileba.vercel.app loads (AC-11 → AC-2).

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

## Milestone 5 — Apartment totals per manager (requested 2026-09-15/18, D-10; needs approval)
- [x] **User action**: crm access provided 2026-09-18 as separate `crm`-scope webhooks (not by extending the lists webhook). Read-only use only.
- [x] Investigate catalog (done 2026-09-18, recorded in SPEC): which method works on this box (`crm.product.list` vs `catalog.product.list`), how a product maps to project (section id = list 111 `PROPERTY_1041`?) and to floor (which `PROPERTY_*`), how flats differ from parking/commercial, product count per project. Record in `docs/SPEC.md` (Data model, Integrations, Standard-first).
- [x] Decide loading strategy from measured volume (D-11: 8 parallel ID-chained batches, 11 s; cached endpoint): aggregated endpoint `api/apartments.js` returning `{projectId: {floor: count}}` using `batch` (≤50 cmds) with backoff on `QUERY_LIMIT_EXCEEDED`, CDN-cached (`s-maxage`), vs direct paging if small. New D-<n> if endpoint is added. Local `file://` mode needs an equivalent path.
- [x] Endpoint `api/apartments.js`: GET-only, no client input, sections derived server-side from list 82 → 111; generic proxy whitelist left unchanged — `api/apartments.js`, `lib/apartments.js`, `vercel.json`.
- [x] Model: `state.apartments.projects[projectId][floor]`; footer total = Σ over manager's floors in visible projects; conflicts: a floor shared by two managers counts for both (state this in tooltip) — `index.html`.
- [x] UI: footer shows `N ბინა` (replaces floor sum per AC-13; keep project count); loading/partial state if apartments fail but floors load; Excel totals row switches to apartments — `index.html`.
- [ ] Tests (after M3 tooling): aggregation, shared-floor rule, missing-floor-data fallback — `test/`.
- [x] Verify: ახმეტელი A = 13 flats × 26 floors = 338 (matches catalog filter counts); per-manager totals 17/17 equal an independent calculation in local and hosted modes; failure path falls back to floors.
- [ ] **User action**: Vercel → Settings → Environments → Production → add `BITRIX_CRM_WEBHOOK` (crm-scope webhook URL) → Redeploy. Until then production shows floor totals with «ბინები: შეცდომა».
- [ ] Hand check by the user of 1–2 managers against the Bitrix catalog UI.

## Status
v1 implemented and deployed (M0 partial, M1–M2 done). M3: Not started — tooling approved (D-9), remaining M3 steps and this file await approval. M4: deferred.

Last session 2026-09-18: apartment totals implemented (lib/apartments.js, api/apartments.js, footer + Excel), verified 17/17 managers in local and hosted dev modes; phones request closed; next: user sets `BITRIX_CRM_WEBHOOK` on Vercel + Redeploy, then M3 tooling/tests (now also for `aggregateProducts`/`readChain`); watch out: CRM webhook has full `crm` scope, code must stay read-only (`crm.product.list` only); apartment data is cached up to 30 min.
