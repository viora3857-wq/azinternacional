import { pino, type Logger } from 'pino';

export function createLogger(level: string): Logger {
  return pino({
    level,
    // Nunca registrar cookies, cabeçalhos de autorização ou tokens.
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.token',
        '*.challenge',
        '*.code',
        '*.email',
      ],
      censor: '[redacted]',
    },
  });
}
