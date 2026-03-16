import express from 'express';
import {
  listResolvedTemplates,
  resolveTemplateById,
  resolveTemplateByType,
  updateResolvedTemplateByType,
} from '../utils/template-resolution.js';

const router = express.Router();

function extractUpdatePayload(body = {}) {
  const payload = {};
  if (body.content !== undefined) payload.content = body.content;
  if (body.is_active !== undefined) payload.is_active = body.is_active;
  if (body.name !== undefined) payload.name = body.name;
  return payload;
}

// Listar templates resolvidos (1 por tipo, priorizando owner)
router.get('/', async (req, res) => {
  try {
    const data = await listResolvedTemplates(req.ownerId);
    res.json(data);
  } catch {
    res.status(500).json({ message: 'Erro ao buscar templates' });
  }
});

// Buscar template resolvido por tipo
router.get('/by-type/:type', async (req, res) => {
  try {
    const activeParam = String(req.query.active || '').toLowerCase();
    const activeOnly = activeParam === '1' || activeParam === 'true';
    const template = await resolveTemplateByType(req.params.type, req.ownerId, { activeOnly });

    if (!template) {
      return res.status(404).json({ message: 'Template não encontrado' });
    }

    res.json(template);
  } catch {
    res.status(500).json({ message: 'Erro ao buscar template por tipo' });
  }
});

// Atualizar template resolvido pelo tipo
router.put('/by-type/:type', async (req, res) => {
  try {
    const payload = extractUpdatePayload(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo' });
    }

    const updated = await updateResolvedTemplateByType(req.params.type, req.ownerId, payload);
    if (!updated) {
      return res.status(404).json({ message: 'Template não encontrado' });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Erro ao atualizar template' });
  }
});

// Compatibilidade: atualizar por ID antigo, mas resolvendo para o template atual do tipo
router.put('/:id', async (req, res) => {
  try {
    const payload = extractUpdatePayload(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo' });
    }

    const resolvedById = await resolveTemplateById(req.params.id, req.ownerId);
    if (!resolvedById) {
      return res.status(404).json({ message: 'Template não encontrado' });
    }

    const updated = await updateResolvedTemplateByType(resolvedById.type, req.ownerId, payload);
    if (!updated) {
      return res.status(404).json({ message: 'Template não encontrado' });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Erro ao atualizar template' });
  }
});

export default router;
