import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deployRouter from './routes/deploy.js';
import authRouter from './routes/auth.js';
import whatsappRouter from './routes/whatsapp.js';
import clientsRouter from './routes/clients.js';
import templatesRouter from './routes/templates.js';
import dashboardRouter from './routes/dashboard.js';
import queueRouter from './routes/queue.js';
import settingsRouter from './routes/settings.js';
import billsRouter from './routes/bills.js';
import traccarRouter from './routes/traccar.js';
import { startScheduler } from './scheduler.js';
import { extractOwnerId } from './middleware/owner.js';
import { reconcileTenantSchema } from './db.js';

const envPath = new URL('../.env', import.meta.url);
dotenv.config({ path: envPath.pathname });

const app = express();

app.use(cors());
app.use(express.json());
app.use(extractOwnerId);

// Rotas da API
app.use('/api', deployRouter);
app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/templates/messages', templatesRouter);
app.use('/api/dashboard/stats', dashboardRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/queue', queueRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/bills', billsRouter);

app.get('/api/health', async (_req, res) => {
  const { hasColumn } = await import('./db.js');
  const schema = {};
  for (const table of ['clients', 'billing_queue', 'bills_payable', 'message_templates', 'billing_settings']) {
    try {
      schema[table] = { owner_id: await hasColumn(table, 'owner_id') };
    } catch {
      schema[table] = { owner_id: false };
    }
  }
  res.json({
    status: 'ok',
    code_version: 'v3-bootstrap-tolerant',
    has_reconcile: true,
    schema,
  });
});

const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';

async function bootstrap() {
  try {
    await reconcileTenantSchema();

    const server = app.listen(PORT, HOST, () => {
      console.log(`API rodando em http://${HOST}:${PORT}`);
      startScheduler();
    });

    server.on('error', (err) => {
      console.error('Falha ao subir API:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('Falha ao reconciliar schema:', err);
    process.exit(1);
  }
}

bootstrap();
