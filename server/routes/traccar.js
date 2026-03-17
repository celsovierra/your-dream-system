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

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    res.json({ data });
  } catch (err) {
    console.error('Traccar proxy error:', err);
    res.status(500).json({ error: err.message || 'Erro desconhecido' });
  }
});

// ===== Endpoint para buscar últimos eventos ignitionOff em lote =====
// Usa batching com delay para não estourar rate limit do Traccar
router.post('/ignition-events', async (req, res) => {
  try {
    const { traccar_url, traccar_user, traccar_password } = req.body;

    if (!traccar_url || !traccar_user || !traccar_password) {
      return res.status(400).json({ error: 'Credenciais do Traccar não fornecidas' });
    }

    const baseUrl = traccar_url.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${traccar_user}:${traccar_password}`).toString('base64')}`;
    const cacheKey = getCacheKey(traccar_url, traccar_user);

    // Verificar cache
    const cached = ignitionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ data: cached.data, cached: true });
    }

    // 1. Buscar todos os dispositivos
    const devices = await fetchTraccar(baseUrl, authHeader, '/api/devices');
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.json({ data: {} });
    }

    // 2. Definir intervalo de busca (últimos 7 dias)
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 3. Tentar buscar por grupos primeiro (menos requisições)
    let allEvents = [];
    let usedGroups = false;

    try {
      const groups = await fetchTraccar(baseUrl, authHeader, '/api/groups');
      if (Array.isArray(groups) && groups.length > 0) {
        for (let i = 0; i < groups.length; i++) {
          try {
            const endpoint = `/api/reports/events?groupId=${groups[i].id}&type=ignitionOff&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
            const events = await fetchTraccar(baseUrl, authHeader, endpoint);
            if (Array.isArray(events)) {
              allEvents.push(...events);
            }
          } catch (err) {
            console.warn(`[ignition-events] Error fetching group ${groups[i].id}:`, err.message);
          }
          // Delay entre grupos para evitar rate limit
          if (i < groups.length - 1) {
            await sleep(3000);
          }
        }
        usedGroups = allEvents.length > 0;
      }
    } catch (err) {
      console.warn('[ignition-events] Could not fetch groups, falling back to batched deviceId:', err.message);
    }

    // 4. Fallback: buscar por lotes de deviceId se grupos não funcionaram
    if (!usedGroups) {
      const BATCH_SIZE = 30;
      for (let i = 0; i < devices.length; i += BATCH_SIZE) {
        const batch = devices.slice(i, i + BATCH_SIZE);
        const deviceIds = batch.map(d => `deviceId=${d.id}`).join('&');
        const endpoint = `/api/reports/events?${deviceIds}&type=ignitionOff&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

        try {
          const events = await fetchTraccar(baseUrl, authHeader, endpoint);
          if (Array.isArray(events)) {
            allEvents.push(...events);
          }
        } catch (err) {
          console.warn(`[ignition-events] Batch ${i}-${i + BATCH_SIZE} failed:`, err.message);
        }

        // Delay entre lotes para evitar rate limit
        if (i + BATCH_SIZE < devices.length) {
          await sleep(3000);
        }
      }
    }

    // 5. Agrupar por deviceId e pegar o ÚLTIMO ignitionOff (eventTime mais recente)
    const result = {};
    allEvents.forEach(event => {
      if (!event.deviceId || !event.eventTime) return;
      const existing = result[event.deviceId];
      if (!existing || new Date(event.eventTime).getTime() > new Date(existing).getTime()) {
        result[event.deviceId] = event.eventTime;
      }
    });

    // 6. Salvar no cache
    ignitionCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`[ignition-events] Fetched ${allEvents.length} events for ${Object.keys(result).length} devices (groups: ${usedGroups})`);
    res.json({ data: result });
  } catch (err) {
    console.error('Traccar ignition-events error:', err);
    res.status(500).json({ error: err.message || 'Erro desconhecido' });
  }
});

export default router;
