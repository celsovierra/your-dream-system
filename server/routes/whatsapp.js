import express from 'express';

const router = express.Router();

async function tryFetch(url, options) {
  try {
    console.log(`[WhatsApp] ${options.method || 'GET'} ${url}`);
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    console.log(`[WhatsApp] Response ${res.status} from ${url}:`, JSON.stringify(data).substring(0, 500));
    return { status: res.status, data, url };
  } catch (e) {
    console.log(`[WhatsApp] Error fetching ${url}:`, e.message);
    return { status: 0, data: { error: e.message }, url };
  }
}

// Proxy para Evolution API — replica a lógica da Edge Function evolution-proxy
router.post('/', async (req, res) => {
  try {
    const { api_url, api_key, instance_name, action, to, message } = req.body;

    if (!api_url || !api_key || !instance_name) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: api_url, api_key, instance_name' });
    }

    const baseUrl = api_url.replace(/\/+$/, '');
    const headers = { apikey: api_key, 'Content-Type': 'application/json' };

    // ===== CREATE =====
    if (action === 'create') {
      const createBody = JSON.stringify({
        instanceName: instance_name,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });

      const createResult = await tryFetch(`${baseUrl}/instance/create`, {
        method: 'POST', headers, body: createBody,
      });

      if (createResult.status === 200 || createResult.status === 201) {
        const cd = createResult.data;
        const qr = cd?.qrcode?.base64 || cd?.base64 || cd?.qrcode;
        if (qr && typeof qr === 'string' && qr.length > 50) {
          return res.json({ success: true, qrcode: qr });
        }
        const state = cd?.instance?.state || cd?.state || '';
        if (state === 'open' || state === 'connected') {
          return res.json({ success: true, state: 'connected', qrcode: null });
        }
      }

      // Try connect to get QR
      const connectResult = await tryFetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: 'GET', headers: { apikey: api_key },
      });

      if (connectResult.status === 200 || connectResult.status === 201) {
        const cn = connectResult.data;
        const qr = cn?.base64 || cn?.qrcode?.base64 || cn?.qrcode || cn?.qr;
        if (qr && typeof qr === 'string' && qr.length > 50) {
          return res.json({ success: true, qrcode: qr });
        }
        const state = cn?.instance?.state || cn?.state || '';
        if (state === 'open' || state === 'connected') {
          return res.json({ success: true, state: 'connected', qrcode: null });
        }
      }

      return res.status(500).json({ success: false, error: 'Não foi possível gerar o QR Code' });
    }

    // ===== STATUS =====
    if (action === 'status') {
      const result = await tryFetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: 'GET', headers: { apikey: api_key },
      });

      if (result.status === 200) {
        return res.json({
          success: true,
          state: result.data?.instance?.state || result.data?.state || 'unknown',
        });
      }

      return res.status(500).json({ error: 'Não foi possível verificar status' });
    }

    // ===== SEND TEXT =====
    if (action === 'send-text') {
      if (!to || !message) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: to, message' });
      }

      const sendUrl = `${baseUrl}/message/sendText/${instance_name}`;
      const sendBody = JSON.stringify({ number: to, text: message });

      const result = await tryFetch(sendUrl, { method: 'POST', headers, body: sendBody });

      if (result.status === 200 || result.status === 201) {
        return res.json({ success: true, data: result.data });
      }

      return res.status(500).json({ error: 'Erro ao enviar mensagem', debug: result.data });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

export default router;
