<!-- last-synced: 2026-09-09, commit: 0ec4ae5 -->
# Technical spec — floor responsibility report

## Data model

### Source: Bitrix24 list IBLOCK_ID 82 (type `lists`), element NAME = "მენეჯერი" — READ ONLY
From `lists.field.get` (2026-09-09). Values arrive as `{ "<valueId>": "<value>" }` objects.

| Field | Name (Bitrix) | Type | Required by app | Notes |
|---|---|---|---|---|
| `PROPERTY_430` | პროექტი | E (link to IBLOCK 111) | yes | element ID; name via `DISPLAY_VALUES_FORM` of this field |
| `PROPERTY_431` | სართული-დან | N | fallback only | |
| `PROPERTY_432` | სართული-მდე | N | fallback only | |
| `PROPERTY_986` | ყველა სართული | L | no | `1321`=კი, `1322`=არა; read but not used (no total-floor source) |
| `PROPERTY_433` | ლუწი / კენტი | L | fallback only | `812`=ლუწი, `813`=კენტი |
| `PROPERTY_434` | პასუხისმგებელი | S:employee | yes | user ID |
| `PROPERTY_1033` | floors(sorted) | S, multiple | **primary** | precomputed floor list, odd/even already applied |
| `PROPERTY_1357` | პროექტი (name) | S | fallback | project name as text |
| `PROPERTY_486`, `PROPERTY_489`, `PROPERTY_490` | Body User, დედლაინები | S | no | ignored |

### Source: `user.get`
| Field | Used as |
|---|---|
| `NAME` + `LAST_NAME` | manager name (whitespace collapsed) |
| `EMAIL` | email |
| `WORK_PHONE` \|\| `PERSONAL_MOBILE` \|\| `PERSONAL_PHONE` | phone, `+995` stripped |
| `UF_PHONE_INNER` | inner number |
| `ACTIVE` | stored, not displayed |

### Client-side model (`buildModel()` in `index.html`) — NEW, in-memory
| Structure | Shape | Notes |
|---|---|---|
| `projects[]` | `{id, name, hasConflict}` | sorted `Intl.Collator('ka', numeric)` |
| `managers[]` | `{id, name, email, phone, inner, active}` | sorted by name; missing user → `მომხმარებელი #<id>` |
| `cells` | `Map<projectId, Map<managerId, Set<floor>>>` | multiple records per pair are unioned |
| `owners` | `Map<projectId, Map<floor, Set<managerId>>>` | conflict = size > 1 |
| `counts` | `{elements, used}` | `used` = records with project, manager and ≥1 floor |

## Business logic
| # | Trigger | Condition | Action | AC | Standard coverage |
|---|---|---|---|---|---|
| BL-1 | page load / «განახლება» | — | fetch all elements (paginate `start`/`next`), fields, users; rebuild model; render | AC-2, AC-9 | custom: standard list view is row-based, D-1 |
| BL-2 | per record | `PROPERTY_1033` non-empty | floors = parsed ints, unique, sorted | AC-1 | custom, D-3 |
| BL-3 | per record | `PROPERTY_1033` empty | floors = `[from..to]`, filtered by `PROPERTY_433` (even/odd); skip if from/to missing or span > 500 | AC-1 | custom, D-3 |
| BL-4 | render cell | floors set | `formatRanges()` → consecutive runs `a - b`, singles `a`, joined `, `; count `N სართ.` | AC-1 | custom, D-1 |
| BL-5 | render cell | any floor in cell has >1 owner in same project | class `conflict`, `!` badge, tooltip lists floor + other managers; project gets red dot | AC-6 | custom: no standard overlap check in Lists, D-1 |
| BL-6 | render footer | — | per visible manager: sum of cell counts and number of projects over visible rows | AC-7 | custom, D-1 |
| BL-7 | filter change | project/manager selections | empty selection = all; rows/cols filtered; totals recomputed | AC-4 | custom, D-1 |
| BL-8 | floor input | integer entered | cells containing floor → `hit`; others dimmed; answer line: ≤10 hits listed, >10 → count + hint, 0 → "არ მოიძებნა" | AC-5 | custom, D-1 |
| BL-9 | «Excel export» | model loaded | SheetJS AOA: 4 header rows, visible rows, totals row; `!cols` widths; `!freeze` 1×4; file `floors-report-YYYY-MM-DD.xlsx` | AC-8 | custom: standard list export is flat rows, D-1 |
| BL-10 | fetch error | HTTP error / `error` in JSON / network | red banner with message + «ხელახლა ცდა»; `server_config` → Vercel env instructions | AC-10, AC-11 | custom, D-2 |
| BL-11 | startup | `window.ARCHI_CONFIG.webhook` present | call Bitrix directly (CORS `*` verified) | AC-12 | custom, D-2 |
| BL-12 | startup | no local webhook and `location.protocol` is http(s) | call `/api/bitrix?method=<m>` proxy | AC-11, AC-12 | custom, D-2 |
| BL-13 | proxy request | method ∉ {`lists.element.get`, `lists.field.get`, `user.get`} or not POST | 400 / 405 JSON error | AC-12 | custom, D-4 |
| BL-14 | proxy request | method starts with `lists.` | force `IBLOCK_TYPE_ID`, `IBLOCK_ID` from env (default `lists`, 82) | AC-12 | custom, D-4 |

## Standard-first check
Checked by analysis of self-hosted Bitrix24 features; **not verified in the running instance** (PRD OQ-6).

| Requirement | Standard feature checked | Covers it? | If no → approach / ref |
|---|---|---|---|
| Matrix project × manager with floor ranges | Lists module: list view, filters, grouping | no — row-based, no pivot | custom HTML report, D-1 |
| Same, exported | Lists → Excel export | partial — flat rows, pivot must be built manually each time | custom SheetJS export, D-1 |
| Pivot/report over a List | CRM Report designer / Analytics | no — self-hosted reports cover CRM entities, not Lists | D-1 |
| BI Builder | Bitrix24 BI Builder | no — cloud-only, not available self-hosted | D-1 |
| Overlap detection | Lists validation, BP | partial — a BP could check on save, but does not show existing overlaps | client-side conflict marking, D-1; BP for prevention out of scope |
| Live data without server | Bitrix REST webhook + CORS `Access-Control-Allow-Origin: *` (verified 2026-09-09) | yes | used directly (local), D-2 |
| Secret not in public repo | — | — | gitignored `config.js`, Vercel env + proxy, D-4 |

## Views / UI (all in `index.html`)
| View | Element ids / classes | Key elements | Visibility |
|---|---|---|---|
| Top bar | `.topbar`, `#meta` | title, counts + last load time, controls | always; hidden in print |
| Project filter | `#msProjects` (`createMultiSelect`) | search, «ყველას მონიშვნა», «გასუფთავება», checkbox list, ⚠ marker for conflict projects | always |
| Manager filter | `#msManagers` | same; sub = inner number | always |
| Floor search | `#floorInput`, `#floorClear` | number input, clear × | always |
| Actions | `#btnClear`, `#btnExcel`, `#btnRefresh` | clear all filters, export, reload | Excel disabled until model loaded |
| Status banner | `#status` (`.loading` / `.error`) | spinner or error + `#btnRetry` | while loading / on error |
| Answer line | `#answer` | floor search result pills | when floor set |
| Legend | `#legend` | filled / conflict / hit swatches | after load |
| Grid | `#grid` (`table.grid`) | sticky `thead` (4-line manager header), sticky first column `.proj`, `.cell.filled/.conflict/.hit`, sticky `tfoot` totals | always; column hover via `data-col` |

No user groups; page has no auth (D-5).

## Security
- **No authentication** on the page (D-5). Anyone with the Vercel URL sees the report and can call the proxy.
- Proxy (`api/bitrix.js`): POST only; method whitelist; forces `IBLOCK_ID`/`IBLOCK_TYPE_ID`; `Cache-Control: no-store`; webhook from `process.env.BITRIX_WEBHOOK` only.
- Exposure via proxy: read access to list 82 elements/fields and `user.get` (employee directory) of the portal — with the webhook owner's rights (user 1 = admin, D-7).
- Repo hygiene: `.gitignore` → `config.js`, `.claude/`. Verified: no webhook or token string in any tracked file or commit (`git grep` on HEAD, 2026-09-09).
- Bitrix scopes used: `lists`, `user`.

## Integrations
| Call | Direction | Auth | Payload | Paging | Errors |
|---|---|---|---|---|---|
| `POST {webhook}/lists.element.get.json` | app → Bitrix | webhook in URL (local) / server env (proxy) | `{IBLOCK_TYPE_ID:"lists", IBLOCK_ID:82, ELEMENT_ORDER:{ID:"ASC"}, start}` | `next` → `start`, 50/page, guard 500 pages | HTTP ≠ 2xx or `error` → throw; banner |
| `POST …/lists.field.get.json` | app → Bitrix | same | `{IBLOCK_TYPE_ID, IBLOCK_ID}` | — | same |
| `POST …/user.get.json` | app → Bitrix | same | `{ID:[…≤50], start}` | chunks of 50 + `next` | same |
| `POST /api/bitrix?method=<m>` | browser → Vercel fn | none | same body as above (IBLOCK fields overwritten) | passthrough | 405/400/500(`server_config`)/502(`upstream_error`) |

Retry: manual only («ხელახლა ცდა»). No backoff on `QUERY_LIMIT_EXCEEDED` yet (4–5 calls per load; see PLAN M3).

## Bitrix specifics
- Self-hosted portal crm.archi.ge; inbound webhook of user ID 1; code stored in `config.js` (local) / `BITRIX_WEBHOOK` (Vercel).
- No OAuth app, no event subscriptions, no BP activities. `PROPERTY_1033` is populated by an existing portal-side process (not part of this repo; origin unknown).
- REST responses include `Access-Control-Allow-Origin: *` (checked with `Origin: http://localhost:8080`).

## Migration / data
- No data written anywhere. No install step in Bitrix. Deploy = push to `main`; Vercel env `BITRIX_WEBHOOK` must exist (set once).
- If list fields are renumbered: update `CONFIG.props`; if list ID changes: `config.js` / `BITRIX_IBLOCK_ID`.

## Tests
**Current state: no automated tests.** Verification so far is manual/headless (see PLAN M2). Planned tests (tooling approved, D-9; implementation in PLAN M3):

| AC | Test (planned) | Asserts |
|---|---|---|
| AC-1 | `formatRanges([1,2,3,4,5,21,22,23,24,25,26])` | `"1 - 5, 21 - 26"`; `[4]` → `"4"`; `[]` → `""` |
| AC-1 | `buildModel` merges two records same pair | cell floors = union |
| AC-1 | fallback floors | from=1,to=8,odd → `[1,3,5,7]` |
| AC-6 | `buildModel` with overlapping records | `owners.get(pid).get(10).size === 2`, `hasConflict === true` |
| AC-7 | totals over filtered view | sum equals Σ cell counts of visible rows |
| AC-11–13 | `api/bitrix.js` handler with mocked req/res | 405 on GET, 400 on `crm.lead.list`, 500 `server_config` without env, `IBLOCK_ID` forced to env value |
| AC-2, AC-9 | headless render against live portal | meta counts, 93 filled cells, status hidden |

## Traceability
| AC | Code | Tests |
|---|---|---|
| AC-1 | `propValues`, `floorsFromRange`, `formatRanges`, `buildModel` | planned unit |
| AC-2 | `fetchAllElements`, `fetchUsers`, `renderMeta` | headless (manual, 2026-09-09: 40/17/96) |
| AC-3 | `displayPhone`, `cleanName`, thead render in `render()` | manual |
| AC-4 | `createMultiSelect`, `currentView`, `#btnClear` | manual |
| AC-5 | `#floorInput`, `render()` hit logic, `renderAnswer` | manual |
| AC-6 | `owners`, `cellData().conflicts`, `.cell.conflict` | headless (2 conflict cells: ქობულეთი რეზორტი C) |
| AC-7 | `totals` in `render()`, `tfoot` | manual |
| AC-8 | `exportExcel` | manual |
| AC-9 | `loadData`, `#btnRefresh` | manual |
| AC-10 | `callRest` error paths, `setStatus('error')` | manual |
| AC-11 | `api/bitrix.js` `server_config`, `callRest` mapping | local dev-server test (2026-09-09) |
| AC-12 | `.gitignore`, `api/bitrix.js` whitelist + IBLOCK force | `git grep` + dev-server test (2026-09-09) |
