// ===== ENDPOINT DE DEPLOY PARA A VPS =====
// Adicione este arquivo ao seu servidor Express na VPS
// Importe e use: app.use('/api', require('./routes/deploy'));

const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

// Token simples para proteger o endpoint - configure o mesmo no frontend
const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN || 'cobranca-deploy-2024';

router.post('/deploy', (req, res) => {
  const token = req.headers['x-deploy-token'];
  
  if (token !== DEPLOY_TOKEN) {
    return res.status(403).json({ success: false, error: 'Token inválido' });
  }

  const command = `cd /opt/cobranca-pro && git pull && npm install && npm run build && mysql -u cobranca_admin -p'Xk9mL2vR7pQ4nW' cobranca_pro < database/schema.sql && pm2 restart cobranca-api && sudo systemctl restart nginx`;

  res.json({ success: true, message: 'Deploy iniciado...' });

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Deploy error:', error.message);
      return;
    }
    console.log('Deploy concluído:', stdout);
  });
});

module.exports = router;
