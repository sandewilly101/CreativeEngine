import { ApiError } from '../utils/helpers.js';
import { isProd } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Translate MySQL errors into something a client can act on.
  if (err.code === 'ER_DUP_ENTRY') {
    const field = err.sqlMessage?.match(/for key '(.+?)'/)?.[1] || 'field';
    err = ApiError.conflict(`That value is already in use (${field})`);
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    err = ApiError.badRequest('A referenced record does not exist');
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    err = ApiError.conflict('This record is still in use elsewhere and cannot be deleted');
  } else if (err.code === 'ER_DATA_TOO_LONG') {
    err = ApiError.badRequest('One of the values supplied is too long');
  } else if (err.code === 'ECONNREFUSED' && err.port) {
    err = new ApiError(503, 'Cannot reach the database. Is MySQL running?');
  } else if (err.name === 'ZodError') {
    err = ApiError.badRequest('Validation failed', err.errors);
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    err = ApiError.badRequest('That file is too large');
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    err = ApiError.badRequest('Unexpected file field');
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`);
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 && isProd ? 'Something went wrong on our side' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}
