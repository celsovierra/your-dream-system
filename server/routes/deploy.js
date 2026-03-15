import express from 'express';
import { exec } from 'node:child_process';

const router = express.Router();

const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN || 'cobranca-deploy-2024';

// Verifica se há atualizações disponíveis (compara local vs remoto)
router.get('/check-update', (_req, res) => {
  exec('cd /opt/cobranca-pro && git fetch origin main 2>/dev/null && git rev-parse HEAD && git rev-parse origin/main', (error, stdout) => {
    if (error) {
      return res.json({ success: false, hasUpdate: false, error: error.message });
    }

    const [local, remote] = stdout.trim().split('\n');
    return res.json({
      success: true,
      hasUpdate: local !== remote,
      localCommit: local?.substring(0, 7),
      remoteCommit: remote?.substring(0, 7),
    });
  });
});

router.post('/deploy', (req, res) => {
  const token = req.headers['x-deploy-token'];

  if (token !== DEPLOY_TOKEN) {
    return res.status(403).json({ success: false, error: 'Token inválido' });
  }

  const command = "cd /opt/cobranca-pro && git pull && npm install && npm run build && mysql -u cobranca_admin -p'Xk9mL2vR7pQ4nW' cobranca_pro < database/schema.sql && pm2 restart cobranca-api && sudo systemctl restart nginx";

  res.json({ success: true, message: 'Deploy iniciado...' });

  exec(command, (error, stdout) => {
    if (error) {
      console.error('Deploy error:', error.message);
      return;
    }

    console.log('Deploy concluído:', stdout);
  });

  return undefined;
});

export default router;
