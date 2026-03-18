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

// ===== Google Drive helpers =====

async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.access_token;
  } catch {
    return null;
  }
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId: string): Promise<string | null> {
  try {
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      if (searchData.files?.length > 0) return searchData.files[0].id;
    }
    const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    });
    if (createResp.ok) {
      const folder = await createResp.json();
      return folder.id;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadPdfToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  pdfBase64: string
): Promise<{ fileId: string; webViewLink: string } | null> {
  try {
    const binaryStr = atob(pdfBase64.replace(/^data:application\/pdf;base64,/, ""));
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const boundary = "contract_pdf_" + Date.now();
    const encoder = new TextEncoder();

    const part1 = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    );
    const part2 = encoder.encode(`\r\n--${boundary}--`);

    const body = new Uint8Array(part1.length + bytes.length + part2.length);
    body.set(part1, 0);
    body.set(bytes, part1.length);
    body.set(part2, part1.length + bytes.length);

    const resp = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[contract-sign] Drive upload error:", errText);
      return null;
    }

    const data = await resp.json();

    // Make file publicly readable
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    return { fileId: data.id, webViewLink: data.webViewLink };
  } catch (err) {
    console.error("[contract-sign] Upload exception:", err);
    return null;
  }
}

// ===== Main handler =====

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

    const payload = await req.json();
    const { token, name, whatsapp, pdfBase64, tenant_id } = payload;

    if (!token || !name || !whatsapp || !pdfBase64) {
      return json(400, { success: false, error: "Campos obrigatórios faltando" });
    }

    // Validate invite
    const { data: invite, error: inviteErr } = await supabase
      .from("contract_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) return json(404, { success: false, error: "Convite não encontrado" });
    if (invite.status === "signed") return json(400, { success: false, error: "Contrato já assinado" });
    if (new Date(invite.expires_at) < new Date()) return json(400, { success: false, error: "Link expirado" });

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const signedAt = new Date().toISOString();
    const effectiveTenantId = tenant_id || invite.tenant_id;

    // Upload pre-built PDF to Google Drive
    let driveFileId: string | null = null;
    let driveFileUrl: string | null = null;

    const { data: driveConfig } = await supabase
      .from("google_drive_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (driveConfig?.client_id && driveConfig?.client_secret && driveConfig?.refresh_token && driveConfig?.folder_id) {
      console.log("[contract-sign] Uploading PDF to Google Drive...");
      const accessToken = await getGoogleAccessToken(
        driveConfig.client_id,
        driveConfig.client_secret,
        driveConfig.refresh_token
      );

      if (accessToken) {
        const contratosFolderId = await findOrCreateFolder(accessToken, "contratos", driveConfig.folder_id);

        if (contratosFolderId) {
          let targetFolderId = contratosFolderId;
          if (effectiveTenantId) {
            const { data: tenantData } = await supabase
              .from("tenants")
              .select("slug")
              .eq("id", effectiveTenantId)
              .maybeSingle();
            if (tenantData?.slug) {
              const tenantFolderId = await findOrCreateFolder(accessToken, tenantData.slug, contratosFolderId);
              if (tenantFolderId) targetFolderId = tenantFolderId;
            }
          }

          const safeName = name.replace(/[^a-zA-Z0-9À-ú\s]/g, "").replace(/\s+/g, "_");
          const dateStr = new Date(signedAt).toISOString().slice(0, 10);
          const fileName = `Contrato_${safeName}_${dateStr}.pdf`;

          const uploadResult = await uploadPdfToDrive(accessToken, targetFolderId, fileName, pdfBase64);
          if (uploadResult) {
            driveFileId = uploadResult.fileId;
            driveFileUrl = uploadResult.webViewLink;
            console.log("[contract-sign] PDF uploaded:", driveFileUrl);
          } else {
            console.warn("[contract-sign] PDF upload failed");
          }
        }
      }
    } else {
      console.log("[contract-sign] Google Drive not configured, skipping upload");
    }

    // Update invite
    const { error: updateErr } = await supabase
      .from("contract_invites")
      .update({
        status: "signed",
        signed_at: signedAt,
        client_data: null,
        client_name: name,
        google_drive_file_id: driveFileId,
        google_drive_file_url: driveFileUrl,
      })
      .eq("id", invite.id);

    if (updateErr) {
      console.error("[contract-sign] Error updating invite:", updateErr.message);
      return json(500, { success: false, error: "Erro ao registrar assinatura" });
    }

    console.log(`[contract-sign] Contract signed by ${name} | IP: ${ipAddress} | Drive: ${driveFileUrl || "not uploaded"}`);

    return json(200, {
      success: true,
      inviteId: invite.id,
      driveFileUrl,
      driveFileId,
      message: driveFileUrl
        ? "Contrato assinado e salvo no Google Drive!"
        : "Contrato assinado com sucesso!",
    });
  } catch (err) {
    console.error("[contract-sign] Internal error:", err);
    return json(500, { success: false, error: "Erro interno do servidor" });
  }
});
