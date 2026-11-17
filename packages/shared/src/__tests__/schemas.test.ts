import { describe, expect, it } from 'vitest';
import {
  displayNameSchema,
  emailSchema,
  onboardingSchema,
  opaqueTokenSchema,
  passwordSchema,
} from '../index';

describe('emailSchema', () => {
  it('normaliza espaços e caixa', () => {
    expect(emailSchema.parse('  Aluno@Escola.Example ')).toBe('aluno@escola.example');
  });
  it('rejeita formato inválido e e-mail longo demais', () => {
    expect(emailSchema.safeParse('sem-arroba').success).toBe(false);
    expect(emailSchema.safeParse(`${'a'.repeat(250)}@x.io`).success).toBe(false);
  });
});

describe('displayNameSchema', () => {
  it('aceita nomes com acento, hífen e apóstrofo', () => {
    expect(displayNameSchema.safeParse('João D’Ávila').success).toBe(true);
    expect(displayNameSchema.safeParse("Ana-Luíza O'Neil").success).toBe(true);
  });
  it('rejeita markup e números', () => {
    expect(displayNameSchema.safeParse('<script>').success).toBe(false);
    expect(displayNameSchema.safeParse('Ana 123').success).toBe(false);
  });
});

describe('onboardingSchema', () => {
  const base = {
    displayName: 'Ana Souza',
    locale: 'pt' as const,
    acceptTerms: true as const,
    acceptPrivacy: true as const,
  };
  it('aceita cadastro completo', () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });
  it('exige aceite explícito dos termos e da política', () => {
    const r = onboardingSchema.safeParse({ ...base, acceptTerms: false, acceptPrivacy: false });
    expect(r.error?.issues.map((i) => i.path.join('.'))).toEqual(['acceptTerms', 'acceptPrivacy']);
  });
});

describe('passwordSchema', () => {
  it('exige de 10 a 128 caracteres', () => {
    expect(passwordSchema.safeParse('curta').success).toBe(false);
    expect(passwordSchema.safeParse('uma frase longa qualquer').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
});

describe('opaqueTokenSchema', () => {
  it('aceita somente 43 caracteres base64url', () => {
    expect(opaqueTokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
    expect(opaqueTokenSchema.safeParse('a'.repeat(42)).success).toBe(false);
    expect(opaqueTokenSchema.safeParse(`${'a'.repeat(42)}=`).success).toBe(false);
  });
});
