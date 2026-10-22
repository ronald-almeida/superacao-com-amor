// Vercel serverless function: creates one genuine PIX charge using Black Cat.
// The amount is deliberately fixed on the server, never read from the browser.
const AMOUNT_CENTS = 39770;
const BLACKCAT_ENDPOINT = 'https://api.blackcatoficial.com/api/sales/create-sale';
const digits = (v) => String(v || '').replace(/\D/g, '');
const okEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function validCPF(value) {
  const v = digits(value);
  if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
  for (let n = 9; n <= 10; n++) {
    const sum = [...v.slice(0, n)].reduce((s, x, i) => s + Number(x) * (n + 1 - i), 0);
    const check = (sum * 10) % 11 % 10;
    if (check !== Number(v[n])) return false;
  }
  return true;
}
function validCNPJ(value) {
  const v = digits(value);
  if (!/^\d{14}$/.test(v) || /^(\d)\1{13}$/.test(v)) return false;
  const check = (n) => {
    const weights = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = weights.reduce((s, w, i) => s + Number(v[i]) * w, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(v[12]) && check(13) === Number(v[13]);
}
const send = (res, code, data) => res.status(code).setHeader('Cache-Control', 'no-store').json(data);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Método não permitido.' });
  }
  if (!process.env.BLACKCAT_API_KEY) return send(res, 503, { error: 'O pagamento Pix ainda não foi configurado neste site.' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  const customer = data.customer || {};
  const name = String(customer.name || '').trim().replace(/\s+/g, ' ');
  const email = String(customer.email || '').trim().toLowerCase();
  const inputPhone = digits(customer.phone);
  const phone = inputPhone.length === 13 && inputPhone.startsWith('55') ? inputPhone.slice(2) : inputPhone;
  const document = digits(customer.document);
  if (name.length < 5 || name.length > 120 || !name.includes(' ') || !okEmail(email) || email.length > 180 ||
      phone.length < 10 || phone.length > 11 || !(validCPF(document) || validCNPJ(document))) {
    return send(res, 400, { error: 'Confira nome completo, e-mail, telefone e CPF/CNPJ.' });
  }

  const payload = {
    amount: AMOUNT_CENTS,
    currency: 'BRL',
    paymentMethod: 'pix',
    items: [{ title: 'Programa: Superação com Amor', unitPrice: AMOUNT_CENTS, quantity: 1, tangible: false }],
    customer: { name, email, phone, document: { number: document, type: document.length === 14 ? 'cnpj' : 'cpf' } },
    pix: { expiresInDays: 1 },
    metadata: 'Checkout Programa Superação com Amor',
    externalRef: `SUP-${crypto.randomUUID()}`,
  };
  const utm = data.utm || {};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
    if (typeof utm[key] === 'string') payload[key] = utm[key].slice(0, 150);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(BLACKCAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.BLACKCAT_API_KEY },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      // 500/timeouts might already have created a charge. Do not falsely promise they did not.
      return send(res, response.status >= 500 ? 502 : 400, {
        error: response.status >= 500 ? 'Não foi possível confirmar a geração do Pix. Verifique antes de tentar novamente.' : 'Não foi possível gerar o Pix. Confira seus dados.',
        code: response.status >= 500 ? 'PAYMENT_UNCERTAIN' : 'PAYMENT_REJECTED',
      });
    }
    const sale = json.data || {};
    const p = sale.paymentData || {};
    const copyPaste = p.copyPaste || p.qrCode;
    if (!copyPaste || typeof copyPaste !== 'string' || !sale.transactionId || sale.amount !== AMOUNT_CENTS) {
      return send(res, 502, { error: 'A cobrança retornou dados incompletos. Confira seu pagamento antes de tentar novamente.', code: 'PAYMENT_UNCERTAIN' });
    }
    const qrCodeBase64 = typeof p.qrCodeBase64 === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(p.qrCodeBase64) ? p.qrCodeBase64 : '';
    return send(res, 201, { transactionId: sale.transactionId, status: sale.status || 'PENDING', amount: sale.amount, copyPaste, qrCodeBase64, expiresAt: p.expiresAt || null });
  } catch (error) {
    return send(res, 502, { error: 'A operadora não confirmou a geração do Pix. Verifique antes de tentar novamente.', code: 'PAYMENT_UNCERTAIN' });
  } finally { clearTimeout(timeout); }
};
