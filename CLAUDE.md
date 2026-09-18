<!-- last-synced: 2026-09-18, commit: 23c847d+apartments -->
# archi_gadanacileba_floor — floor responsibility report

## Stack
- Bitrix24 **self-hosted** (crm.archi.ge, "Bitrix Site Manager"), REST via **inbound webhook** (user ID 1). Methods: `lists.element.get`, `lists.field.get`, `user.get`. No Business Processes, no PHP.
- Frontend: single `index.html`, vanilla JS (ES2020), no build step. CDN: SheetJS `xlsx` 0.18.5 (cdnjs), Noto Sans Georgian (Google Fonts).
- Hosting: Vercel Hobby, Node serverless functions `api/bitrix.js`, `api/apartments.js` (CommonJS). Prod URL: https://floor-gadanacileba.vercel.app
- Second webhook with `crm` scope for apartments (`crm.product.list` only).
- Local: Node v24 available; page opens from `file://` with `config.js`.
- Repo: GitHub `refreshg/floor_gadanacileba` (**public**), branch `main`.

## Commands
```powershell
# open locally (needs config.js, see config.example.js)
Start-Process .\index.html
# headless render check against live Bitrix (verified working)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --virtual-time-budget=15000 --dump-dom "file:///C:/Users/dchac/Desktop/vs%20code/archi_gadanacileba_floor/index.html"
# deploy = push to main (Vercel auto-deploys)
git push origin main
```
No test runner, no linter, no `package.json` yet — approved to add (`node:test`, no runtime deps), see docs/PLAN.md M3 / D-9. Update this section when added.

## Layout
- `index.html` — whole app (CSS + JS). `CONFIG` object at top of `<script>`.
- `api/bitrix.js` — Vercel proxy; reads `BITRIX_WEBHOOK`, `BITRIX_IBLOCK_ID`, `BITRIX_IBLOCK_TYPE`.
- `lib/apartments.js` (UMD, browser + Node) and `api/apartments.js` — flats per project per floor from the CRM catalog; env `BITRIX_CRM_WEBHOOK`; `vercel.json` sets `maxDuration`.
- `config.js` (gitignored) / `config.example.js` — local webhook config (`window.ARCHI_CONFIG`).
- `docs/` — PRD, SPEC, PLAN, ARCHITECTURE, DECISIONS. `README.md` — user/ops guide (Georgian).

## Conventions
- Bitrix fields referenced by ID via `CONFIG.props` (`PROPERTY_430` project … `PROPERTY_1033` floors). Never hardcode elsewhere.
- Bitrix property values arrive as `{valueId: value}` objects → always read via `propValues()` / `propFirst()`.
- UI text Georgian; code identifiers and comments English (Georgian allowed in user-facing strings/comments).
- Georgian sorting via `Intl.Collator('ka', {numeric: true})`.
- Commit messages: **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`), body explains why; end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Rules (MUST / NEVER)
- **STANDARD FIRST**: before custom code, check standard Bitrix24 (list views/filters, Excel export of lists, CRM report designer, BI Builder, robots/BP). Custom only after naming the standard feature checked, stating why it doesn't fit, and getting user confirmation recorded as `D-<n>` in docs/DECISIONS.md. Order: configuration → standard report/export → extend this page → new component.
- NEVER commit webhook URLs, tokens, or `config.js`. `.gitignore` covers `config.js` and `.claude/`. Repo is public.
- NEVER add REST methods to `api/bitrix.js` `ALLOWED_METHODS` without a DECISIONS entry; proxy MUST keep forcing `IBLOCK_ID`.
- Bitrix REST: paginate with `start`/`next` (50 per page); use `batch` for >50 calls; on `QUERY_LIMIT_EXCEEDED` back off and retry.
- `PROPERTY_1033` (floors sorted) is the floor source of truth; `PROPERTY_431/432` + odd/even only as fallback.
- Report is **read-only**: NEVER write to list 82 from this app.
- **CRM is READ-ONLY** (user instruction 2026-09-18): the only CRM command allowed is `crm.product.list` (plus `crm.product.fields`/`scope` for investigation). NEVER add/update/delete anything in CRM; NEVER whitelist CRM methods in `api/bitrix.js`; `/api/apartments` MUST take no client input.
- Catalog reads: ID paging with `start=-1` in chained `batch`, stop at first short page; keep parallelism ≤ 8.
- Verify with the headless render check (counts + known cells) before pushing.

## Workflow
PRD → SPEC → PLAN → code → verification → `/docs-sync`. `docs/PLAN.md` must be approved by the user before implementation of any new step starts.

## Docs map
- `docs/PRD.md` — problem, users, stories, acceptance criteria (Georgian).
- `docs/SPEC.md` — data model, logic, standard-first table, integrations, tests.
- `docs/PLAN.md` — milestones and checkboxes; needs user approval.
- `docs/ARCHITECTURE.md` — components, data flow, extension points.
- `docs/DECISIONS.md` — ADRs `D-1…`.
- `README.md` — how to run, deploy on Vercel, configure, security notes.
