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

    if (action === "create") {
      // Step 1: Tentar criar instância
      console.log("Creating instance:", instance_name);
      let createData: any = null;
      try {
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: { "apikey": api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName: instance_name, qrcode: true }),
        });
        createData = await createRes.json();
        console.log("Create response:", JSON.stringify(createData));
      } catch (e) {
        console.log("Create failed (may already exist):", e.message);
      }

      // Check if create response has QR code
      const createQr = createData?.qrcode?.base64 || createData?.base64 || createData?.qrcode;
      if (createQr && typeof createQr === "string" && createQr.length > 50) {
        console.log("QR from create response, length:", createQr.length);
        return new Response(JSON.stringify({ success: true, qrcode: createQr }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Tentar connect endpoint
      console.log("Trying connect endpoint...");
      try {
        const connectRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
          headers: { "apikey": api_key },
        });
        const connectData = await connectRes.json();
        console.log("Connect response:", JSON.stringify(connectData));
        
        const connectQr = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qrcode || connectData?.qr;
        if (connectQr && typeof connectQr === "string" && connectQr.length > 50) {
          return new Response(JSON.stringify({ success: true, qrcode: connectQr }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if already connected
        const state = connectData?.instance?.state || connectData?.state || "";
        if (state === "open" || state === "connected") {
          return new Response(JSON.stringify({ success: true, state: "connected", qrcode: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.log("Connect failed:", e.message);
      }

      // Step 3: Tentar fetchInstances para ver status
      console.log("Trying fetchInstances...");
      try {
        const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instance_name}`, {
          headers: { "apikey": api_key },
        });
        const fetchData = await fetchRes.json();
        console.log("FetchInstances response:", JSON.stringify(fetchData));
      } catch (e) {
        console.log("FetchInstances failed:", e.message);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: "QR Code não encontrado nas respostas da API",
        debug: { createData },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const res = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        headers: { "apikey": api_key },
      });
      const data = await res.json();
      console.log("Status response:", JSON.stringify(data));
      return new Response(JSON.stringify({
        success: true,
        state: data?.instance?.state || data?.state || "unknown",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'create' ou 'status'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Evolution proxy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
