// Vercel serverless proxy → Bitrix24 REST.
// Webhook ინახება Vercel-ის Environment Variable-ში (BITRIX_WEBHOOK), ბრაუზერში არ ჩანს.
// დაშვებულია მხოლოდ რეპორტისთვის საჭირო read-only მეთოდები და მხოლოდ ერთი ლისტი.

const ALLOWED_METHODS = new Set(['lists.element.get', 'lists.field.get', 'user.get']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', error_description: 'Use POST' });
  }

  const webhook = process.env.BITRIX_WEBHOOK;
  if (!webhook) {
    return res.status(500).json({
      error: 'server_config',
      error_description: 'BITRIX_WEBHOOK environment variable is not set on the server',
    });
  }

  const method = String((req.query && req.query.method) || '');
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: 'forbidden_method', error_description: `Method "${method}" is not allowed` });
  }

  let body = {};
  if (req.body && typeof req.body === 'object') body = { ...req.body };
  else if (typeof req.body === 'string' && req.body) {
    try { body = JSON.parse(req.body); } catch { body = {}; }
  }

  // ლისტის მეთოდები მხოლოდ კონფიგურირებულ ლისტზე
  if (method.startsWith('lists.')) {
    body.IBLOCK_TYPE_ID = process.env.BITRIX_IBLOCK_TYPE || 'lists';
    body.IBLOCK_ID = Number(process.env.BITRIX_IBLOCK_ID || 82);
  }

  const base = webhook.endsWith('/') ? webhook : webhook + '/';
  try {
    const upstream = await fetch(base + method + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'upstream_error', error_description: String(e && e.message || e) });
  }
};
