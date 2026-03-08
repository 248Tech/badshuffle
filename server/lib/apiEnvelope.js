/**
 * API v1 response envelope middleware.
 * Wraps res.json so all responses under /api/v1 use a consistent shape:
 * - Success (2xx): { data, meta: { version, timestamp } }
 * - Error (4xx/5xx): { error: { code, message, details? } }
 */
const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
};

function codeFromStatus(status) {
  return STATUS_CODES[status] || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
}

function envelopeMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const status = res.statusCode || 200;
    const isError = status >= 400;
    const timestamp = new Date().toISOString();

    if (isError) {
      const message = body && (typeof body.error === 'string' ? body.error : body.message) || 'Request failed';
      const code = codeFromStatus(status);
      const payload = {
        error: {
          code,
          message,
          ...(body && typeof body === 'object' && body.details !== undefined && { details: body.details }),
        },
        meta: { version: 'v1', timestamp },
      };
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(payload));
    }

    const payload = {
      data: body,
      meta: { version: 'v1', timestamp },
    };
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(payload));
  };
  next();
}

module.exports = envelopeMiddleware;
