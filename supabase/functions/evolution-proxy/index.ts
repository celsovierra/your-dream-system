import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function tryFetch(url: string, options: RequestInit): Promise<{ status: number; data: any; url: string }> {
  try {
    console.log(`Trying: ${options.method || 'GET'} ${url}`);
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    console.log(`Response ${res.status} from ${url}:`, JSON.stringify(data).substring(0, 500));
    return { status: res.status, data, url };
  } catch (e) {
    console.log(`Error fetching ${url}:`, e.message);
    return { status: 0, data: { error: e.message }, url };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { api_url, api_key, instance_name, action } = await req.json();

    if (!api_url || !api_key || !instance_name) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios: api_url, api_key, instance_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = api_url.replace(/\/+$/, "");
    const headers = { "apikey": api_key, "Content-Type": "application/json" };

    if (action === "create") {
      // Try multiple endpoint patterns for different Evolution API versions
      const createBody = JSON.stringify({ 
        instanceName: instance_name, 
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      });
      
      // The correct endpoint is /instance/create (confirmed by logs)
      const createEndpoints = [
        `${baseUrl}/instance/create`,
      ];

      let createResult: any = null;
      for (const url of createEndpoints) {
        const result = await tryFetch(url, { method: "POST", headers, body: createBody });
        if (result.status === 200 || result.status === 201) {
          createResult = result;
          break;
        }
        // If 409 (already exists), that's fine - proceed to connect
        if (result.status === 409) {
          createResult = result;
          break;
        }
        // Store last non-404 result
        if (result.status !== 404 && result.status !== 0) {
          createResult = result;
        }
      }

      // Extract QR from create response
      if (createResult && (createResult.status === 200 || createResult.status === 201)) {
        const cd = createResult.data;
        const qr = cd?.qrcode?.base64 || cd?.base64 || cd?.qrcode;
        if (qr && typeof qr === "string" && qr.length > 50) {
          return new Response(JSON.stringify({ success: true, qrcode: qr }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Check if already connected
        const state = cd?.instance?.state || cd?.state || "";
        if (state === "open" || state === "connected") {
          return new Response(JSON.stringify({ success: true, state: "connected", qrcode: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Try connect endpoints to get QR code
      const connectEndpoints = [
        `${baseUrl}/instance/connect/${instance_name}`,
        `${baseUrl}/api/v1/instance/connect/${instance_name}`,
        `${baseUrl}/api/v2/instance/connect/${instance_name}`,
      ];

      for (const url of connectEndpoints) {
        const result = await tryFetch(url, { method: "GET", headers: { "apikey": api_key } });
        if (result.status === 200 || result.status === 201) {
          const cn = result.data;
          const qr = cn?.base64 || cn?.qrcode?.base64 || cn?.qrcode || cn?.qr;
          if (qr && typeof qr === "string" && qr.length > 50) {
            return new Response(JSON.stringify({ success: true, qrcode: qr }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const state = cn?.instance?.state || cn?.state || "";
          if (state === "open" || state === "connected") {
            return new Response(JSON.stringify({ success: true, state: "connected", qrcode: null }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Also try fetchInstances to see what's available
      const listResult = await tryFetch(`${baseUrl}/instance/fetchInstances`, { 
        method: "GET", 
        headers: { "apikey": api_key } 
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Não foi possível gerar o QR Code",
        debug: {
          createResult: createResult ? { status: createResult.status, data: createResult.data, url: createResult.url } : null,
          instances: listResult.status === 200 ? listResult.data : null,
          apiVersion: "tried /instance/*, /api/v1/instance/*, /api/v2/instance/*"
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const statusEndpoints = [
        `${baseUrl}/instance/connectionState/${instance_name}`,
        `${baseUrl}/api/v1/instance/connectionState/${instance_name}`,
        `${baseUrl}/api/v2/instance/connectionState/${instance_name}`,
      ];
      
      for (const url of statusEndpoints) {
        const result = await tryFetch(url, { method: "GET", headers: { "apikey": api_key } });
        if (result.status === 200) {
          return new Response(JSON.stringify({
            success: true,
            state: result.data?.instance?.state || result.data?.state || "unknown",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Não foi possível verificar status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
