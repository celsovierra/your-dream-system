import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deployRouter from './routes/deploy.js';

const envPath = new URL('../.env', import.meta.url);
dotenv.config({ path: envPath.pathname });

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', deployRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`API rodando em http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('Falha ao subir API:', err);
  process.exit(1);
});
