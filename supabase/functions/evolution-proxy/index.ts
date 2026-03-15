import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const results: Record<string, any> = {};

    if (action === "create") {
      // Step 1: Create instance
      try {
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: { "apikey": api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName: instance_name, qrcode: true }),
        });
        results.create = { status: createRes.status, data: await createRes.json() };
      } catch (e) {
        results.create = { error: e.message };
      }

      // Extract QR from create
      const cd = results.create?.data;
      let qr = cd?.qrcode?.base64 || cd?.base64 || cd?.qrcode;
      if (qr && typeof qr === "string" && qr.length > 50) {
        return new Response(JSON.stringify({ success: true, qrcode: qr }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Connect
      try {
        const connectRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
          headers: { "apikey": api_key },
        });
        results.connect = { status: connectRes.status, data: await connectRes.json() };
      } catch (e) {
        results.connect = { error: e.message };
      }

      const cn = results.connect?.data;
      qr = cn?.base64 || cn?.qrcode?.base64 || cn?.qrcode || cn?.qr;
      if (qr && typeof qr === "string" && qr.length > 50) {
        return new Response(JSON.stringify({ success: true, qrcode: qr }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if connected
      const state = cn?.instance?.state || cn?.state || cd?.instance?.state || cd?.state || "";
      if (state === "open" || state === "connected") {
        return new Response(JSON.stringify({ success: true, state: "connected", qrcode: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return debug info so frontend can show it
      return new Response(JSON.stringify({ success: false, error: "QR não encontrado", debug: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      try {
        const res = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
          headers: { "apikey": api_key },
        });
        const data = await res.json();
        return new Response(JSON.stringify({
          success: true,
          state: data?.instance?.state || data?.state || "unknown",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
