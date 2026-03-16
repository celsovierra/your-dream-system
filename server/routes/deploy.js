import express from 'express';
import { exec } from 'node:child_process';

const router = express.Router();

const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN || 'cobranca-deploy-2024';
const PROJECT_DIR = process.env.PROJECT_DIR || '/opt/cobranca-pro';
const DEPLOY_TIMEOUT_MS = 10 * 60 * 1000;

function shellQuote(value = '') {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildDeployCommand() {
  const projectDir = shellQuote(PROJECT_DIR);
  const dbUser = shellQuote(process.env.DB_USER || 'cobranca_admin');
  const dbPass = shellQuote(process.env.DB_PASS || '');
  const dbName = shellQuote(process.env.DB_NAME || 'cobranca_pro');

  return `
    cd ${projectDir} &&
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main) &&
    git stash push --include-untracked -m "auto-deploy-$(date +%s)" >/dev/null 2>&1 || true &&
    git fetch origin "$BRANCH" &&
    git pull --rebase origin "$BRANCH" &&
    npm install &&
    npm run build &&
    mysql -u ${dbUser} -p${dbPass} ${dbName} < database/schema.sql &&
    (pm2 restart cobranca-api || pm2 start server/index.js --name cobranca-api) &&
    sudo systemctl restart nginx
  `;
}

// Verifica se há atualizações disponíveis (compara local vs remoto)
router.get('/check-update', (_req, res) => {
  const script = `
    cd ${shellQuote(PROJECT_DIR)} &&
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main") &&
    git fetch origin "$BRANCH" 2>/dev/null &&
    echo "$BRANCH" &&
    git rev-parse HEAD &&
    git rev-parse "origin/$BRANCH"
  `;

  exec(script, { shell: '/bin/bash' }, (error, stdout) => {
    if (error) {
      console.error('check-update error:', error.message);
      return res.json({ success: false, hasUpdate: false, error: error.message });
    }

    const lines = stdout.trim().split('\n');
    const branch = lines[0];
    const local = lines[1];
    const remote = lines[2];

    return res.json({
      success: true,
      hasUpdate: local !== remote,
      branch,
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

  const command = buildDeployCommand();

  exec(
    command,
    {
      shell: '/bin/bash',
      timeout: DEPLOY_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    },
    (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();

      if (error) {
        console.error('Deploy error:', error.message, output);
        return res.status(500).json({
          success: false,
          error: output || error.message || 'Falha ao atualizar a VPS',
        });
      }

      console.log('Deploy concluído:', output || 'sem saída');
      return res.json({
        success: true,
        message: 'Atualização concluída com sucesso.',
        output,
      });
    }
  );

  return undefined;
});

export default router;
