// Vercel serverless: aggregated flat counts per project per floor (READ-ONLY).
// Reads list 82 + list 111 (BITRIX_WEBHOOK, scope lists) and the CRM product catalog
// (BITRIX_CRM_WEBHOOK, scope crm; falls back to BITRIX_WEBHOOK). Takes NO client input.
// The only CRM command ever issued is crm.product.list (see lib/apartments.js).
// CDN-cached: a full catalog read takes ~10 s, so viewers are served from cache.

const { loadApartments } = require('../lib/apartments.js');

function caller(base) {
  const root = base.endsWith('/') ? base : base + '/';
  return async (method, params) => {
    const r = await fetch(root + method + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' (' + method + ')');
    const j = await r.json();
    if (j.error) throw new Error(j.error + ': ' + (j.error_description || '') + ' (' + method + ')');
    return j;
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'method_not_allowed', error_description: 'Use GET' });
  }
  const lists = process.env.BITRIX_WEBHOOK;
  const crm = process.env.BITRIX_CRM_WEBHOOK || lists;
  if (!lists) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'server_config', error_description: 'BITRIX_WEBHOOK environment variable is not set on the server' });
  }
  try {
    const data = await loadApartments({
      callLists: caller(lists),
      callCrm: caller(crm),
      options: {
        iblockType: process.env.BITRIX_IBLOCK_TYPE || 'lists',
        floorsIblockId: Number(process.env.BITRIX_IBLOCK_ID || 82),
      },
    });
    // 30 min fresh at the CDN, then served stale while one background refresh runs
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    const msg = String((e && e.message) || e);
    const scope = /insufficient_scope/i.test(msg);
    return res.status(scope ? 500 : 502).json({
      error: scope ? 'crm_config' : 'upstream_error',
      error_description: scope
        ? 'BITRIX_CRM_WEBHOOK (crm scope) is not set on the server or has no access to products. Vercel: Settings, Environments, Production, add BITRIX_CRM_WEBHOOK, then Redeploy.'
        : msg,
    });
  }
};
