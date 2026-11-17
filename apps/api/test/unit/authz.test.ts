import { describe, expect, it } from 'vitest';
import { accountStatus } from '../../src/middleware/auth';
import { canShutdown } from '../../src/modules/admin/admin.routes';

describe('accountStatus', () => {
  it('pede onboarding até aceitar os termos; depois fica ativo', () => {
    expect(accountStatus({ onboarded_at: null })).toBe('onboarding_required');
    expect(accountStatus({ onboarded_at: new Date() })).toBe('active');
  });
});

describe('canShutdown', () => {
  it.each([
    ['admin', 'student', true],
    ['admin', 'admin', false],
    ['admin', 'owner', false],
    ['owner', 'student', true],
    ['owner', 'admin', true],
    ['owner', 'owner', false],
    ['student', 'student', false],
  ] as const)('%s -> %s = %s', (actor, target, expected) => {
    expect(canShutdown(actor, target)).toBe(expected);
  });
});
