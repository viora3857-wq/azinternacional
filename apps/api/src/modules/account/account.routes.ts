import { deleteAccountSchema, onboardingSchema, updateProfileSchema } from '@az/shared';
import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { parseInput } from '../../lib/errors';
import { authOf, requireAuth } from '../../middleware/auth';
import { clearSessionCookie } from '../auth/sessions';
import { completeOnboarding, deleteAccount, getMe, updateProfile } from './account.service';

export function accountRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/me', requireAuth, async (req, res) => {
    res.json(await getMe(deps, authOf(req)));
  });

  r.patch('/account/profile', requireAuth, async (req, res) => {
    const input = parseInput(updateProfileSchema, req.body);
    await updateProfile(deps, authOf(req), input);
    res.status(204).end();
  });

  r.post('/account/onboarding', requireAuth, async (req, res) => {
    const input = parseInput(onboardingSchema, req.body);
    await completeOnboarding(deps, authOf(req), input, req.ipHash);
    res.status(204).end();
  });

  r.post('/account/delete', requireAuth, async (req, res) => {
    const { confirmEmail } = parseInput(deleteAccountSchema, req.body);
    await deleteAccount(deps, authOf(req), confirmEmail, req.ipHash);
    clearSessionCookie(res, deps.config);
    res.status(204).end();
  });

  return r;
}
