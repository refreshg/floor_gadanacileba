// დააკოპირეთ ეს ფაილი როგორც config.js და ჩაწერეთ თქვენი Bitrix24 webhook URL.
// config.js git-ში არ იდება (.gitignore) — webhook CRM-ზე წვდომას იძლევა.
window.ARCHI_CONFIG = {
  webhook: 'https://crm.archi.ge/rest/USER_ID/WEBHOOK_CODE/',
  // optional: webhook with `crm` scope for apartment totals. Used READ-ONLY (crm.product.list).
  crmWebhook: 'https://crm.archi.ge/rest/USER_ID/CRM_WEBHOOK_CODE/',
  iblockType: 'lists',
  iblockId: 82,
};
