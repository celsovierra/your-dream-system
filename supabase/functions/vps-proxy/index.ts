const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-owner-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const vpsBaseUrl = url.searchParams.get('vps_url');
    const endpoint = url.searchParams.get('endpoint');

    if (!vpsBaseUrl || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros vps_url e endpoint são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build target URL
    const targetUrl = `${vpsBaseUrl.replace(/\/+$/, '')}${endpoint}`;

    // Forward headers (except host)
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'origin' || lower === 'referer') continue;
      if (lower === 'apikey' || lower === 'x-client-info') continue;
      forwardHeaders[key] = value;
    }

    // Forward body for non-GET requests
    let body: string | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Proxy error: ${err.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
