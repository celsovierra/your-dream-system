import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deployRouter from './routes/deploy.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', deployRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
