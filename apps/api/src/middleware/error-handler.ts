import type { ApiErrorBody } from '@az/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../lib/errors';

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError('NOT_FOUND'));

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    let appErr: AppError;
    if (err instanceof AppError) {
      appErr = err;
    } else if (isBodyParserError(err, 'entity.too.large')) {
      appErr = new AppError('PAYLOAD_TOO_LARGE');
    } else if (isBodyParserError(err, 'entity.parse.failed')) {
      appErr = new AppError('VALIDATION_FAILED', { fields: ['(body)'] });
    } else {
      appErr = new AppError('INTERNAL', { cause: err });
    }

    if (appErr.status >= 500) {
      logger.error(
        { err: appErr.cause ?? appErr, requestId: req.requestId, code: appErr.code },
        'request failed',
      );
    } else {
      logger.debug({ requestId: req.requestId, code: appErr.code }, 'request rejected');
    }

    const body: ApiErrorBody = {
      error: {
        code: appErr.code,
        requestId: req.requestId,
        ...(appErr.fields ? { fields: appErr.fields } : {}),
      },
    };
    res.status(appErr.status).json(body);
  };
}

function isBodyParserError(err: unknown, type: string): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: unknown }).type === type;
}
