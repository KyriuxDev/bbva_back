// Error handler global.
// Express 5 pasa automáticamente los errores de handlers async aquí.
// Captura el statusCode adjuntado en el servicio y responde con JSON uniforme.

import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  statusCode?: number;
}

export function errorMiddleware(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500;
  const message = err.message ?? 'Error interno del servidor';

  console.error(`[${status}] ${message}`);

  res.status(status).json({ message });
}
