/* Apartment (flat) counts per project per floor, from the Bitrix24 CRM product catalog.
 * UMD: used by the browser (window.ArchiApartments, local file:// mode) and by the
 * Vercel function api/apartments.js (require). No dependencies.
 *
 * Mapping (verified 2026-09-18, see docs/SPEC.md):
 *   list 82  PROPERTY_430  -> project element id (list 111)
 *   list 111 PROPERTY_1041 -> catalog SECTION_ID of that project
 *   product  PROPERTY_376  -> floor, PROPERTY_383 -> unit type ("ბინა" = flat), PROPERTY_427 -> project name
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArchiApartments = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    iblockType: 'lists',
    floorsIblockId: 82,
    projectsIblockId: 111,
    listProps: { project: 'PROPERTY_430', section: 'PROPERTY_1041' },
    product: { floor: 'PROPERTY_376', type: 'PROPERTY_383', projectName: 'PROPERTY_427', flatType: 'ბინა' },
    pageSize: 50,     // Bitrix REST page size (fixed)
    parallel: 8,      // concurrent read chains (measured 2026-09-18: ~1700 rows/s at 8, ~130 rows/s at 1)
    chainLength: 20,  // commands per batch, each continuing after the previous page's last ID (max 50)
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const values = (o) => (o && typeof o === 'object' ? Object.values(o) : o === undefined || o === null || o === '' ? [] : [o]);
  const pval = (x) => (x && typeof x === 'object' ? x.value : x);

  /** Retry on Bitrix rate limiting / temporary unavailability. */
  async function withRetry(fn, tries) {
    let lastErr;
    for (let i = 0; i < (tries || 3); i++) {
      try { return await fn(); } catch (e) {
        lastErr = e;
        if (!/QUERY_LIMIT_EXCEEDED|OPERATION_TIME_LIMIT|HTTP 50[234]/.test(String(e && e.message))) throw e;
        await sleep(1000 * (i + 1));
      }
    }
    throw lastErr;
  }

  async function listAll(call, method, params) {
    const out = [];
    let start = 0;
    for (let guard = 0; guard < 500; guard++) {
      const json = await withRetry(() => call(method, Object.assign({}, params, { start })));
      out.push.apply(out, json.result || []);
      if (json.next === undefined || json.next === null) break;
      start = Number(json.next);
    }
    return out;
  }

  /** READ-ONLY by construction: the only CRM command this library ever builds is crm.product.list. */
  function productQuery(sections, afterExpr, o) {
    const q = new URLSearchParams();
    q.append('order[ID]', 'ASC');
    sections.forEach((s) => q.append('filter[SECTION_ID][]', String(s)));
    q.append('filter[' + o.product.type + ']', o.product.flatType);
    ['ID', 'SECTION_ID', o.product.floor, o.product.projectName].forEach((f) => q.append('select[]', f));
    q.append('start', '-1'); // no COUNT(*): ID-based paging, much faster than offsets on a 65k-row catalog
    // afterExpr is a literal ID or a batch reference like $result[p3][49][ID]; must stay unencoded
    return 'crm.product.list?' + q.toString() + '&filter[>ID]=' + afterExpr;
  }

  /** Reads all flats of the given sections: chained batches, stops at the first short page. */
  async function readChain(callCrm, sections, o) {
    const out = [];
    let after = '0';
    for (let round = 0; round < 200; round++) {
      const cmd = {};
      for (let i = 0; i < o.chainLength; i++) cmd['p' + i] = productQuery(sections, i === 0 ? after : '$result[p' + (i - 1) + '][' + (o.pageSize - 1) + '][ID]', o);
      const b = await withRetry(() => callCrm('batch', { halt: 0, cmd }));
      const errs = b.result.result_error;
      if (errs && Object.keys(errs).length) throw new Error('batch: ' + JSON.stringify(errs).slice(0, 300));
      let done = false;
      for (let i = 0; i < o.chainLength; i++) {
        const rows = (b.result.result || {})['p' + i] || [];
        out.push.apply(out, rows);
        // after a short page the next reference is empty and Bitrix restarts from the beginning: stop here
        if (rows.length < o.pageSize) { done = true; break; }
      }
      if (done) return out;
      after = String(out[out.length - 1].ID);
    }
    throw new Error('readChain: too many rounds');
  }

  /**
   * products: raw crm.product.list rows. sectionToProject: Map<sectionId, projectId>.
   * A section sometimes contains a few units of another project (wrong section in the catalog):
   * a unit is skipped only when its PROPERTY_427 (project name) is NON-EMPTY and differs from the
   * section's dominant non-empty name. An empty name is normal (139 flats of "არქი ახმეტელი C"
   * have none) and is counted: section membership decides.
   */
  function aggregateProducts(products, sectionToProject, options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const bySection = new Map();
    for (const p of products) {
      const sec = String(p.SECTION_ID);
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(p);
    }
    const projects = {};
    const stats = { flats: 0, skippedForeignProject: 0, skippedNoFloor: 0 };
    for (const [sec, rows] of bySection) {
      const projectId = sectionToProject.get(sec);
      if (!projectId) continue;
      const names = new Map();
      rows.forEach((p) => { const n = String(pval(p[o.product.projectName]) || '').trim(); if (n) names.set(n, (names.get(n) || 0) + 1); });
      let dominant = '', best = -1;
      names.forEach((c, n) => { if (c > best) { best = c; dominant = n; } });
      const floors = projects[projectId] || (projects[projectId] = {});
      for (const p of rows) {
        const pname = String(pval(p[o.product.projectName]) || '').trim();
        if (pname && dominant && pname !== dominant) { stats.skippedForeignProject++; continue; }
        const raw = pval(p[o.product.floor]);
        const floor = raw === null || raw === undefined || raw === '' ? NaN : Math.trunc(Number(raw));
        if (!Number.isFinite(floor)) { stats.skippedNoFloor++; continue; }
        floors[floor] = (floors[floor] || 0) + 1;
        stats.flats++;
      }
    }
    return { projects, stats };
  }

  /**
   * callLists(method, params) / callCrm(method, params): async, return parsed Bitrix JSON, throw on error.
   * elements: optional already-fetched list-82 elements (browser passes them to skip a refetch).
   */
  async function loadApartments(args) {
    const o = Object.assign({}, DEFAULTS, (args && args.options) || {});
    const callLists = args.callLists, callCrm = args.callCrm;
    const t0 = Date.now();

    const elements = args.elements || await listAll(callLists, 'lists.element.get', {
      IBLOCK_TYPE_ID: o.iblockType, IBLOCK_ID: o.floorsIblockId, ELEMENT_ORDER: { ID: 'ASC' },
    });
    const projectIds = Array.from(new Set(elements.map((e) => String(values(e[o.listProps.project])[0] || '')).filter(Boolean)));
    if (!projectIds.length) return { generatedAt: new Date().toISOString(), projects: {}, missing: [], stats: { flats: 0 } };

    const projectEls = await listAll(callLists, 'lists.element.get', {
      IBLOCK_TYPE_ID: o.iblockType, IBLOCK_ID: o.projectsIblockId, FILTER: { ID: projectIds },
    });
    const sectionToProject = new Map();
    const missing = [];
    const found = new Set();
    for (const e of projectEls) {
      found.add(String(e.ID));
      const sec = String(values(e[o.listProps.section])[0] || '');
      if (sec) sectionToProject.set(sec, String(e.ID)); else missing.push({ id: String(e.ID), name: e.NAME || '' });
    }
    projectIds.forEach((id) => { if (!found.has(id)) missing.push({ id, name: '' }); });

    const sections = Array.from(sectionToProject.keys());
    let products = [];
    if (sections.length) {
      const k = Math.max(1, Math.min(o.parallel, sections.length));
      const groups = Array.from({ length: k }, () => []);
      sections.forEach((s, i) => groups[i % k].push(s));
      const parts = await Promise.all(groups.map((g) => readChain(callCrm, g, o)));
      const seen = new Set(); // safety net against duplicates
      parts.forEach((rows) => rows.forEach((p) => { if (!seen.has(p.ID)) { seen.add(p.ID); products.push(p); } }));
    }

    const agg = aggregateProducts(products, sectionToProject, o);
    return {
      generatedAt: new Date().toISOString(),
      projects: agg.projects,
      missing,
      stats: Object.assign({ sections: sections.length, ms: Date.now() - t0 }, agg.stats),
    };
  }

  return { loadApartments, aggregateProducts, DEFAULTS };
});
