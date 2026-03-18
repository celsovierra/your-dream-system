import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { action, tenant_id, template_id, client_name, client_user_id, expires_days, token: inviteToken } = body;

    if (!tenant_id) return json(400, { success: false, error: "tenant_id obrigatório" });

    // ===== Create invite =====
    if (action === "create_invite") {
      if (template_id) {
        const { data: tmpl } = await supabase
          .from("contract_templates")
          .select("id")
          .eq("id", template_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (!tmpl) return json(404, { success: false, error: "Template não encontrado" });
      }

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expires_days || 7));

      const { data: invite, error } = await supabase
        .from("contract_invites")
        .insert({
          tenant_id,
          template_id: template_id || null,
          token,
          status: "pending",
          expires_at: expiresAt.toISOString(),
          client_name: client_name || null,
          client_user_id: client_user_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error("[contract-invite] Insert error:", error.message);
        return json(500, { success: false, error: "Erro ao criar convite" });
      }

      return json(200, { success: true, token, invite_id: invite.id, expires_at: expiresAt.toISOString() });
    }

    // ===== Get invite by token =====
    if (action === "get_invite") {
      if (!inviteToken) return json(400, { success: false, error: "Token obrigatório" });

      const { data: invite, error } = await supabase
        .from("contract_invites")
        .select("*, template:contract_templates(content, name)")
        .eq("token", inviteToken)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (error || !invite) return json(404, { success: false, error: "Convite não encontrado" });

      return json(200, { success: true, invite });
    }

    return json(400, { success: false, error: "Ação inválida" });
  } catch (err) {
    console.error("[contract-invite] Error:", err);
    return json(500, { success: false, error: "Erro interno" });
  }
});
