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

    console.log(`[vps-proxy] ${req.method} vps_url=${vpsBaseUrl} endpoint=${endpoint}`);

    if (!vpsBaseUrl || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros vps_url e endpoint são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build target URL
    const targetUrl = `${vpsBaseUrl.replace(/\/+$/, '')}${endpoint}`;
    console.log(`[vps-proxy] -> ${targetUrl}`);

    // Forward headers (except host and supabase-internal)
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      const lower = key.toLowerCase();
      if (['host', 'origin', 'referer', 'apikey', 'x-client-info',
           'x-supabase-client-platform', 'x-supabase-client-platform-version',
           'x-supabase-client-runtime', 'x-supabase-client-runtime-version',
           'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
           'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip',
           'sb-ext-function-id'].includes(lower)) continue;
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
    console.log(`[vps-proxy] <- ${response.status} (${responseBody.length} bytes)`);

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    console.error(`[vps-proxy] ERROR:`, err);
    return new Response(
      JSON.stringify({ error: `Proxy error: ${err.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
