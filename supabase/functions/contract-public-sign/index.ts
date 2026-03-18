import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// ===== Traccar helpers =====

async function traccarAuth(apiUrl: string, email: string, password: string): Promise<string | null> {
  const resp = await fetch(`${apiUrl}api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });
  if (!resp.ok) return null;
  return resp.headers.get("set-cookie") || "";
}

async function createTraccarUser(apiUrl: string, cookies: string, userData: Record<string, unknown>) {
  const resp = await fetch(`${apiUrl}api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookies },
    body: JSON.stringify(userData),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to create user: ${err}`);
  }
  return await resp.json();
}

async function createTraccarDevice(apiUrl: string, cookies: string, deviceData: Record<string, unknown>) {
  const resp = await fetch(`${apiUrl}api/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookies },
    body: JSON.stringify(deviceData),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to create device: ${err}`);
  }
  return await resp.json();
}

async function linkDeviceToUser(apiUrl: string, cookies: string, userId: number, deviceId: number) {
  const resp = await fetch(`${apiUrl}api/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookies },
    body: JSON.stringify({ userId, deviceId }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.warn(`[contract-public-sign] Link warning: ${err}`);
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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
  } catch { return null; }
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
  } catch { return null; }
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
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const boundary = "contract_pdf_" + Date.now();
    const encoder = new TextEncoder();
    const part1 = encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
    const part2 = encoder.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(part1.length + bytes.length + part2.length);
    body.set(part1, 0);
    body.set(bytes, part1.length);
    body.set(part2, part1.length + bytes.length);

    const resp = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    return { fileId: data.id, webViewLink: data.webViewLink };
  } catch (err) {
    console.error("[contract-public-sign] Upload exception:", err);
    return null;
  }
}

// ===== Main handler =====

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const payload = await req.json();
    const {
      tenant_id, name, email, cpf, whatsapp, address, houseNumber, neighborhood, city,
      vehicles, pdfBase64, due_day, template_id,
    } = payload;

    if (!tenant_id || !name || !email || !whatsapp || !pdfBase64 || !due_day) {
      return json(400, { success: false, error: "Campos obrigatórios faltando" });
    }

    // Load tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantErr || !tenant) return json(404, { success: false, error: "Empresa não encontrada" });
    if (!tenant.admin_email || !tenant.admin_password) return json(400, { success: false, error: "Credenciais administrativas não configuradas" });

    const apiUrl = tenant.api_url.endsWith("/") ? tenant.api_url : tenant.api_url + "/";
    const signedAt = new Date().toISOString();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // 1. Authenticate with Traccar
    console.log("[contract-public-sign] Authenticating with Traccar...");
    const cookies = await traccarAuth(apiUrl, tenant.admin_email, tenant.admin_password);
    if (!cookies) return json(500, { success: false, error: "Falha na autenticação com o servidor" });

    // 2. Create Traccar user (or find existing)
    console.log("[contract-public-sign] Creating Traccar user:", email);
    let traccarUser: any;
    try {
      traccarUser = await createTraccarUser(apiUrl, cookies, {
        name,
        email,
        password: "3030",
        phone: whatsapp,
        disabled: false,
        administrator: false,
      });
    } catch (err: any) {
      if (err.message.includes("email") || err.message.includes("Duplicate")) {
        console.log("[contract-public-sign] User already exists, looking up:", email);
        try {
          const usersResp = await fetch(`${apiUrl}api/users`, {
            headers: { "Cookie": cookies },
          });
          if (usersResp.ok) {
            const allUsers = await usersResp.json();
            traccarUser = allUsers.find((u: any) => u.email === email);
          }
        } catch (_) { /* ignore */ }
        if (!traccarUser) {
          return json(400, { success: false, error: "E-mail já cadastrado mas não foi possível localizar o usuário" });
        }
        console.log("[contract-public-sign] Found existing user:", traccarUser.id);
      } else {
        console.error("[contract-public-sign] User creation failed:", err.message);
        return json(400, { success: false, error: "Erro ao criar usuário" });
      }
    }

    console.log("[contract-public-sign] User created:", traccarUser.id);

    // 3. Create Traccar devices for each vehicle and link to user
    const createdDevices: any[] = [];
    for (const v of (vehicles || [])) {
      const deviceName = `${name} - ${v.vehicleModel}`;
      const uniqueId = `AUTO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const device = await createTraccarDevice(apiUrl, cookies, {
          name: deviceName,
          uniqueId,
          category: v.vehicleType === "carro" ? "car" : "motorcycle",
          phone: "",
          model: v.vehicleModel,
          attributes: {
            color: v.vehicleColor,
            plate: v.hasPlate === "sim" ? v.vehiclePlate : "",
          },
        });
        createdDevices.push(device);

        await linkDeviceToUser(apiUrl, cookies, traccarUser.id, device.id);
        console.log("[contract-public-sign] Device created and linked:", device.id, deviceName);
      } catch (err: any) {
        console.warn("[contract-public-sign] Device creation warning:", err.message);
      }
    }

    // 4. Create billing config in Supabase
    let phoneDigits = whatsapp.replace(/\D/g, "").replace(/^0+/, "");
    if (phoneDigits.startsWith("5555")) {
      phoneDigits = phoneDigits.slice(2);
    }
    if (!phoneDigits.startsWith("55")) {
      phoneDigits = `55${phoneDigits}`;
    }
    console.log("[contract-public-sign] Sanitized phone:", phoneDigits, "from raw:", whatsapp);
    const now = new Date();
    const chosenDay = parseInt(due_day);
    let nextDueYear = now.getFullYear();
    let nextDueMonth = now.getMonth();
    let nextDue = new Date(nextDueYear, nextDueMonth, chosenDay);
    if (nextDue <= now || (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) < 20) {
      nextDueMonth++;
      if (nextDueMonth > 11) { nextDueMonth = 0; nextDueYear++; }
    }
    const lastDay = new Date(nextDueYear, nextDueMonth + 1, 0).getDate();
    const safeDay = Math.min(chosenDay, lastDay);
    const nextDueDate = `${nextDueYear}-${String(nextDueMonth + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;

    console.log("[contract-public-sign] Creating billing config. Due day:", chosenDay, "Next due:", nextDueDate);

    const totalAmount = (vehicles || []).length * 50 || 50;
    await supabase.from("client_billing_config").upsert({
      tenant_id,
      user_id: traccarUser.id,
      user_name: name,
      user_phone: phoneDigits,
      due_day: chosenDay,
      amount: totalAmount,
      billing_cycle: "mensal",
      auto_charge: true,
      cobrar: true,
      desconto: 0,
      next_due_date: nextDueDate,
    }, { onConflict: "tenant_id,user_id" });

    // 5. Upload PDF to Google Drive
    let driveFileId: string | null = null;
    let driveFileUrl: string | null = null;

    const { data: driveConfig } = await supabase
      .from("google_drive_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (driveConfig?.client_id && driveConfig?.client_secret && driveConfig?.refresh_token && driveConfig?.folder_id) {
      console.log("[contract-public-sign] Uploading PDF to Google Drive...");
      const accessToken = await getGoogleAccessToken(driveConfig.client_id, driveConfig.client_secret, driveConfig.refresh_token);

      if (accessToken) {
        const contratosFolderId = await findOrCreateFolder(accessToken, "contratos", driveConfig.folder_id);
        if (contratosFolderId) {
          let targetFolderId = contratosFolderId;
          if (tenant.slug) {
            const tenantFolderId = await findOrCreateFolder(accessToken, tenant.slug, contratosFolderId);
            if (tenantFolderId) targetFolderId = tenantFolderId;
          }

          const safeName = name.replace(/[^a-zA-Z0-9À-ú\s]/g, "").replace(/\s+/g, "_");
          const dateStr = new Date(signedAt).toISOString().slice(0, 10);
          const fileName = `Contrato_${safeName}_${dateStr}.pdf`;

          const uploadResult = await uploadPdfToDrive(accessToken, targetFolderId, fileName, pdfBase64);
          if (uploadResult) {
            driveFileId = uploadResult.fileId;
            driveFileUrl = uploadResult.webViewLink;
            console.log("[contract-public-sign] PDF uploaded:", driveFileUrl);
          }
        }
      }
    }

    // 6. Create contract invite record (already signed)
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await supabase.from("contract_invites").insert({
      tenant_id,
      template_id: template_id || null,
      token,
      status: "signed",
      signed_at: signedAt,
      expires_at: expiresAt.toISOString(),
      client_name: name,
      client_user_id: traccarUser.id,
      client_data: null,
      google_drive_file_id: driveFileId,
      google_drive_file_url: driveFileUrl,
    });

    console.log(`[contract-public-sign] Contract signed by ${name} | IP: ${ipAddress} | Traccar user: ${traccarUser.id} | Devices: ${createdDevices.length} | Drive: ${driveFileUrl || "not uploaded"}`);

    // 7. Send WhatsApp confirmation to client
    try {
      const { data: whatsappConfig } = await supabase
        .from("tenant_whatsapp_config")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .maybeSingle();

      if (whatsappConfig?.api_url && whatsappConfig?.api_key && whatsappConfig?.instance_name) {
        const cleanUrl = whatsappConfig.api_url.replace(/\/+$/, "");
        const instancePath = encodeURIComponent(whatsappConfig.instance_name.trim());
        const cleanPhone = phoneDigits;

        const vehicleLines = (vehicles || []).map((v: any, i: number) => {
          const tipo = v.vehicleType === "carro" ? "🚗 Carro" : "🏍️ Moto";
          const placa = v.hasPlate === "sim" && v.vehiclePlate ? ` | Placa: ${v.vehiclePlate}` : "";
          return `${i + 1}. ${tipo} - ${v.vehicleModel} (${v.vehicleColor})${placa}`;
        }).join("\n");

        const vCount = (vehicles || []).length;
        const dueOption = `Dia ${due_day} de cada mês`;
        const contractLine = driveFileUrl
          ? `📄 Contrato digital: ${driveFileUrl}`
          : "📄 Contrato digital: disponível com nosso atendimento";

        const msg = [
          "✅ *Confirmação de Cadastro e Contrato Digital*",
          "",
          `Olá, *${name}*! 👋`,
          `Seu rastreamento com a *${tenant.name}* foi ativado com sucesso.`,
          "",
          "🔐 *Dados de acesso*",
          `📧 E-mail: ${email}`,
          "🔑 Senha: 3030",
          "",
          `🚘 *Veículo${vCount > 1 ? "s" : ""} cadastrado${vCount > 1 ? "s" : ""}*`,
          vehicleLines || "Nenhum veículo informado.",
          "",
          "💳 *Informações de pagamento*",
          `📅 Vencimento: ${dueOption}`,
          `💰 Valor: R$ ${totalAmount.toFixed(2).replace(".", ",")}/mês (${vCount} veículo${vCount > 1 ? "s" : ""})`,
          contractLine,
          "",
          "Qualquer dúvida, estamos à disposição! 😊",
        ].join("\n");

        console.log("[contract-public-sign] Sending WhatsApp to:", cleanPhone);

        let sendRes: Response | null = null;
        let lastSendError: unknown = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            sendRes = await fetchWithTimeout(
              `${cleanUrl}/message/sendText/${instancePath}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: whatsappConfig.api_key.trim(),
                },
                body: JSON.stringify({ number: cleanPhone, text: msg }),
              },
              15000,
            );

            if (sendRes.ok) break;
            if (sendRes.status < 500) break;
          } catch (sendErr: any) {
            lastSendError = sendErr;
            if (attempt === 2) break;
          }
        }

        if (sendRes?.ok) {
          console.log("[contract-public-sign] WhatsApp sent successfully");
        } else if (sendRes) {
          const errText = await sendRes.text();
          console.warn("[contract-public-sign] WhatsApp send failed:", errText);
        } else if (lastSendError) {
          console.warn("[contract-public-sign] WhatsApp send request error (non-blocking):", lastSendError);
        }
      } else {
        console.log("[contract-public-sign] No active WhatsApp config, skipping message");
      }
    } catch (whatsappErr) {
      console.warn("[contract-public-sign] WhatsApp error (non-blocking):", whatsappErr);
    }

    return json(200, {
      success: true,
      traccarUserId: traccarUser.id,
      devicesCreated: createdDevices.length,
      driveFileUrl,
      driveFileId,
      message: "Contrato assinado, usuário e veículos criados com sucesso!",
    });
  } catch (err) {
    console.error("[contract-public-sign] Internal error:", err);
    return json(500, { success: false, error: "Erro interno do servidor" });
  }
});
