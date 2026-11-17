import type { Role } from '@az/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { AppError, parseInput } from '../../lib/errors';
import { authOf, requireRole } from '../../middleware/auth';
import { audit } from '../audit/audit';
import { revokeSessions } from '../auth/sessions';

const paramsSchema = z.object({ id: z.uuid() });

/** Quem pode derrubar sessões de quem. Admin: só alunos. Owner: alunos e admins. Ninguém: owners. */
export function canShutdown(actor: Role, target: Role): boolean {
  if (target === 'owner') return false;
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'student';
}

export function adminRouter(deps: AppDeps): Router {
  const r = Router();
  r.use(requireRole('admin', 'owner'));

  /** "Dar shutdown": invalida todas as sessões do usuário. */
  r.post('/users/:id/shutdown', async (req, res) => {
    const actor = authOf(req);
    const { id } = parseInput(paramsSchema, req.params);

    // Visibilidade pelo RLS: admin só enxerga usuários da própria escola.
    const target = await deps.db.asUser(actor.userId, async (c) => {
      const { rows } = await c.query<{ id: string; role: Role }>(
        'select id, role from public.users where id = $1',
        [id],
      );
      return rows[0];
    });
    if (!target) throw new AppError('NOT_FOUND');
    if (!canShutdown(actor.role, target.role)) throw new AppError('FORBIDDEN');

    const count = await deps.db.system(async (c) => {
      const n = await revokeSessions(c, target.id, 'admin_shutdown');
      await audit(c, {
        actorId: actor.userId,
        action: 'admin.sessions_revoked',
        targetType: 'user',
        targetId: target.id,
        ipHash: req.ipHash,
        metadata: { count: n },
      });
      return n;
    });
    res.json({ revoked: count });
  });

  return r;
}
