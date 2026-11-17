import type { Locale } from '@az/shared';
import type { EmailMessage } from './email.types';

const strings = {
  pt: {
    magicSubject: 'Seu link de acesso à AZ Internacional',
    magicIntro:
      'Use o botão abaixo para entrar. O link vale por 15 minutos e só pode ser usado uma vez.',
    magicButton: 'Entrar na AZ Internacional',
    magicIgnore:
      'Se você não pediu este acesso, ignore este e-mail. Ninguém entra sem clicar no link.',
    verifySubject: 'Confirme seu e-mail na AZ Internacional',
    verifyIntro: 'Falta só confirmar que este e-mail é seu. O link vale por 24 horas.',
    verifyButton: 'Confirmar e-mail',
    verifyIgnore: 'Se você não criou uma conta, ignore este e-mail.',
    resetSubject: 'Redefinir sua senha da AZ Internacional',
    resetIntro:
      'Recebemos um pedido para redefinir sua senha. O link vale por 30 minutos e só funciona uma vez.',
    resetButton: 'Criar nova senha',
    resetIgnore: 'Se não foi você, ignore este e-mail: sua senha atual continua valendo.',
    footer: 'AZ Internacional — mensagem automática, não responda.',
  },
  en: {
    magicSubject: 'Your AZ Internacional sign-in link',
    magicIntro:
      'Use the button below to sign in. The link is valid for 15 minutes and can only be used once.',
    magicButton: 'Sign in to AZ Internacional',
    magicIgnore:
      'If you did not request this, ignore this email. Nobody gets in without clicking the link.',
    verifySubject: 'Confirm your email for AZ Internacional',
    verifyIntro: 'One last step: confirm this email is yours. The link is valid for 24 hours.',
    verifyButton: 'Confirm email',
    verifyIgnore: 'If you did not create an account, ignore this email.',
    resetSubject: 'Reset your AZ Internacional password',
    resetIntro:
      'We received a request to reset your password. The link is valid for 30 minutes and works only once.',
    resetButton: 'Create a new password',
    resetIgnore: 'If this was not you, ignore this email: your current password still works.',
    footer: 'AZ Internacional — automated message, do not reply.',
  },
  es: {
    magicSubject: 'Tu enlace de acceso a AZ Internacional',
    magicIntro:
      'Usa el botón de abajo para entrar. El enlace vale 15 minutos y solo se puede usar una vez.',
    magicButton: 'Entrar en AZ Internacional',
    magicIgnore:
      'Si no pediste este acceso, ignora este correo. Nadie entra sin hacer clic en el enlace.',
    verifySubject: 'Confirma tu correo en AZ Internacional',
    verifyIntro: 'Solo falta confirmar que este correo es tuyo. El enlace vale 24 horas.',
    verifyButton: 'Confirmar correo',
    verifyIgnore: 'Si no creaste una cuenta, ignora este correo.',
    resetSubject: 'Restablece tu contraseña de AZ Internacional',
    resetIntro:
      'Recibimos una solicitud para restablecer tu contraseña. El enlace vale 30 minutos y funciona una sola vez.',
    resetButton: 'Crear nueva contraseña',
    resetIgnore: 'Si no fuiste tú, ignora este correo: tu contraseña actual sigue valiendo.',
    footer: 'AZ Internacional — mensaje automático, no respondas.',
  },
} satisfies Record<Locale, unknown>;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(paragraphs: string[], button: { label: string; href: string }, footer: string) {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:16px/1.5 Arial,sans-serif;color:#14213d">${escapeHtml(p)}</p>`,
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f3ec">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ddd6c8;border-radius:8px;padding:32px">
${body}
<p style="margin:24px 0"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#23408e;color:#ffffff;text-decoration:none;font:600 16px Arial,sans-serif;padding:12px 20px;border-radius:6px">${escapeHtml(button.label)}</a></p>
<p style="margin:0;font:13px/1.5 Arial,sans-serif;color:#5b6475">${escapeHtml(footer)}</p>
</div></body></html>`;
}

export function magicLinkEmail(to: string, locale: Locale, link: string): EmailMessage {
  const s = strings[locale];
  return {
    to,
    tag: 'magic_link',
    subject: s.magicSubject,
    html: layout([s.magicIntro, s.magicIgnore], { label: s.magicButton, href: link }, s.footer),
    text: `${s.magicIntro}\n\n${link}\n\n${s.magicIgnore}\n\n${s.footer}`,
  };
}

export function verifyEmailEmail(to: string, locale: Locale, link: string): EmailMessage {
  const s = strings[locale];
  return {
    to,
    tag: 'verify_email',
    subject: s.verifySubject,
    html: layout([s.verifyIntro, s.verifyIgnore], { label: s.verifyButton, href: link }, s.footer),
    text: `${s.verifyIntro}\n\n${link}\n\n${s.verifyIgnore}\n\n${s.footer}`,
  };
}

export function passwordResetEmail(to: string, locale: Locale, link: string): EmailMessage {
  const s = strings[locale];
  return {
    to,
    tag: 'password_reset',
    subject: s.resetSubject,
    html: layout([s.resetIntro, s.resetIgnore], { label: s.resetButton, href: link }, s.footer),
    text: `${s.resetIntro}\n\n${link}\n\n${s.resetIgnore}\n\n${s.footer}`,
  };
}

/** Exposto só para testes de escape. */
export const layoutForTest = layout;
