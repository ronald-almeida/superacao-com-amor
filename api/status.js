const send = (res, code, body) => res.status(code).setHeader('Cache-Control', 'no-store').json(body);
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return send(res, 405, { error:'Método não permitido.' }); }
  if (!process.env.BLACKCAT_API_KEY) return send(res, 503, { error:'Gateway não configurado.' });
  const id = String(req.query.id || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return send(res, 400, { error:'Transação inválida.' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(`https://api.blackcatoficial.com/api/sales/${encodeURIComponent(id)}/status`, {
      headers: { 'X-API-Key': process.env.BLACKCAT_API_KEY }, cache:'no-store', signal: controller.signal,
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !json.success || json.data?.transactionId !== id) return send(res, 502, { error:'Não foi possível consultar a transação.' });
    return send(res, 200, { transactionId:id, status:json.data.status });
  } catch (_) { return send(res, 502, { error:'Consulta de pagamento indisponível.' }); }
  finally { clearTimeout(timer); }
};
