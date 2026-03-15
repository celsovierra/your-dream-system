import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      // Criar instância
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { "apikey": api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: instance_name, qrcode: true }),
      });
      const createData = await createRes.json();
      
      // Se já tem QR code na resposta de criação
      if (createData?.qrcode?.base64 || createData?.base64) {
        return new Response(JSON.stringify({
          success: true,
          qrcode: createData?.qrcode?.base64 || createData?.base64,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar QR code via connect
      const connectRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        headers: { "apikey": api_key },
      });
      const connectData = await connectRes.json();
      
      return new Response(JSON.stringify({
        success: true,
        qrcode: connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qr || null,
        state: connectData?.instance?.state || connectData?.state || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
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
