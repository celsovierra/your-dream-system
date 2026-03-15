import cron from 'node-cron';
import { query } from './db.js';

// Busca configuração do banco
async function getSetting(key, fallback) {
  try {
    const rows = await query('SELECT `value` FROM billing_settings WHERE `key` = ?', [key]);
    return rows?.[0]?.value || fallback;
  } catch {
    return fallback;
  }
}

// Popula a fila com clientes aptos
async function populateQueue() {
  console.log('[Scheduler] Populando fila de cobranças...');
  try {
    const reminderDays = Number(await getSetting('reminder_days', '3'));
    const overdueFrequency = Number(await getSetting('overdue_frequency', '3'));

    const clients = await query('SELECT * FROM clients WHERE is_active = 1 AND due_date IS NOT NULL AND amount IS NOT NULL AND amount > 0');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let added = 0;

    for (const client of clients) {
      const dueDate = new Date(client.due_date + 'T00:00:00');
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

      let type = null;

      if (diffDays === reminderDays) {
        // Lembrete: X dias antes do vencimento
        type = 'reminder';
      } else if (diffDays === 0) {
        // Dia do vencimento
        type = 'due';
      } else if (diffDays < 0) {
        // Atrasado: verificar frequência
        const daysOverdue = Math.abs(diffDays);
        if (daysOverdue % overdueFrequency === 0) {
          type = 'overdue';
        }
      }

      if (!type) continue;

      // Verificar se já existe na fila hoje
      const existing = await query(
        'SELECT id FROM billing_queue WHERE client_id = ? AND type = ? AND DATE(created_at) = ?',
        [client.id, type, todayStr]
      );

      if (existing && existing.length > 0) continue;

      const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;

      await query(
        'INSERT INTO billing_queue (client_id, client_name, client_phone, type, amount, due_date, days_overdue, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [client.id, client.name, client.phone, type, client.amount, client.due_date, daysOverdue, 'pending']
      );
      added++;
    }

    console.log(`[Scheduler] ${added} clientes adicionados à fila`);
  } catch (err) {
    console.error('[Scheduler] Erro ao popular fila:', err.message);
  }
}

// Limpa a fila
async function clearQueue() {
  console.log('[Scheduler] Limpando fila...');
  try {
    const result = await query('DELETE FROM billing_queue');
    console.log(`[Scheduler] Fila limpa`);
  } catch (err) {
    console.error('[Scheduler] Erro ao limpar fila:', err.message);
  }
}

// Envia mensagens pendentes da fila via WhatsApp
async function processQueue(type) {
  console.log(`[Scheduler] Processando fila tipo: ${type}`);
  try {
    const items = await query(
      'SELECT bq.*, c.phone2 FROM billing_queue bq LEFT JOIN clients c ON bq.client_id = c.id WHERE bq.type = ? AND bq.status = ?',
      [type, 'pending']
    );

    if (!items || items.length === 0) {
      console.log(`[Scheduler] Nenhum item pendente do tipo ${type}`);
      return;
    }

    // Buscar template de mensagem
    const typeMap = { reminder: 'reminder', due: 'due', overdue: 'overdue' };
    const templates = await query('SELECT * FROM message_templates WHERE type = ? AND is_active = 1 LIMIT 1', [typeMap[type]]);
    const template = templates?.[0];

    if (!template) {
      console.log(`[Scheduler] Template do tipo ${type} não encontrado ou desativado`);
      return;
    }

    // Buscar config do WhatsApp
    const waConfig = {
      api_url: '',
      api_key: '',
      instance_name: '',
    };

    try {
      const waRows = await query('SELECT `value` FROM billing_settings WHERE `key` = ?', ['whatsapp_config']);
      if (waRows?.[0]?.value) {
        const parsed = JSON.parse(waRows[0].value);
        waConfig.api_url = parsed.api_url || '';
        waConfig.api_key = parsed.api_key || '';
        waConfig.instance_name = parsed.instance_name || '';
      }
    } catch {}

    if (!waConfig.api_url || !waConfig.api_key || !waConfig.instance_name) {
      console.log('[Scheduler] WhatsApp não configurado, pulando envio');
      return;
    }

    for (const item of items) {
      try {
        // Substituir variáveis no template
        const dueDateFormatted = item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        let msg = template.content
          .replace(/\{nome\}/g, item.client_name)
          .replace(/\{valor\}/g, Number(item.amount || 0).toFixed(2))
          .replace(/\{data_vencimento\}/g, dueDateFormatted)
          .replace(/\{dias_atraso\}/g, String(item.days_overdue || 0))
          .replace(/\{link_pagamento\}/g, '');

        const phone = item.client_phone.replace(/\D/g, '');
        const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;

        // Enviar via Evolution API
        const baseUrl = waConfig.api_url.replace(/\/+$/, '');
        const sendUrl = `${baseUrl}/message/sendText/${waConfig.instance_name}`;

        const res = await fetch(sendUrl, {
          method: 'POST',
          headers: { apikey: waConfig.api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: fullPhone, text: msg }),
        });

        if (res.ok) {
          await query('UPDATE billing_queue SET status = ?, sent_at = NOW(), message = ? WHERE id = ?', ['sent', msg, item.id]);
          console.log(`[Scheduler] ✓ Enviado para ${item.client_name} (${type})`);
        } else {
          const errData = await res.text();
          await query('UPDATE billing_queue SET status = ?, message = ? WHERE id = ?', ['failed', `Erro: ${errData.substring(0, 200)}`, item.id]);
          console.log(`[Scheduler] ✗ Falha ao enviar para ${item.client_name}: ${errData.substring(0, 100)}`);
        }

        // Delay entre envios para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        await query('UPDATE billing_queue SET status = ?, message = ? WHERE id = ?', ['failed', err.message, item.id]);
        console.error(`[Scheduler] Erro ao enviar para ${item.client_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[Scheduler] Erro ao processar fila:`, err.message);
  }
}

export function startScheduler() {
  console.log('[Scheduler] Iniciando agendador de cobranças...');

  // 6:00 — Limpar fila do dia anterior
  cron.schedule('0 6 * * *', () => {
    clearQueue();
  }, { timezone: 'America/Sao_Paulo' });

  // 7:00 — Popular fila com clientes aptos
  cron.schedule('0 7 * * *', () => {
    populateQueue();
  }, { timezone: 'America/Sao_Paulo' });

  // A cada minuto: verificar se é hora de enviar cada tipo
  cron.schedule('* * * * *', async () => {
    const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });

    const sendTimeReminder = await getSetting('send_time_reminder', '08:00');
    const sendTimeDue = await getSetting('send_time_due', '08:00');
    const sendTimeOverdue = await getSetting('send_time_overdue', '09:00');

    if (now === sendTimeReminder) processQueue('reminder');
    if (now === sendTimeDue) processQueue('due');
    if (now === sendTimeOverdue) processQueue('overdue');
  }, { timezone: 'America/Sao_Paulo' });

  console.log('[Scheduler] Agendador configurado: limpar 6h, popular 7h, enviar nos horários configurados');
}
