import express from 'express';

const router = express.Router();

// Proxy genérico para a API do Traccar
router.post('/proxy', async (req, res) => {
  try {
    const { traccar_url, traccar_user, traccar_password, endpoint = '/api/users', method = 'GET', body } = req.body;

    if (!traccar_url || !traccar_user || !traccar_password) {
      return res.status(400).json({ error: 'Credenciais do Traccar não fornecidas' });
    }

    if (!endpoint.startsWith('/')) {
      return res.status(400).json({ error: 'Endpoint inválido' });
    }

    const baseUrl = traccar_url.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${traccar_user}:${traccar_password}`).toString('base64')}`;

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Traccar API error [${response.status}]: ${errorText}` });
    }

    const data = await response.json();
    res.json({ data });
  } catch (err) {
    console.error('Traccar proxy error:', err);
    res.status(500).json({ error: err.message || 'Erro desconhecido' });
  }
});

export default router;
