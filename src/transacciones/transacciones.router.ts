import { Router, Request, Response } from 'express';
import { transaccionesService } from './transacciones.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const transaccionesRouter = Router();
transaccionesRouter.use(authMiddleware);

/**
 * @swagger
 * /api/v1/transacciones:
 *   get:
 *     summary: Listar transacciones con filtros
 *     tags: [Transacciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *         description: Fecha inicio (YYYY-MM-DD)
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: categoria
 *         schema: { type: string }
 *       - in: query
 *         name: canal
 *         schema: { type: string }
 *       - in: query
 *         name: fraude
 *         schema: { type: boolean }
 *         description: Filtrar solo transacciones con fraude potencial
 *       - in: query
 *         name: tipo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada de transacciones
 */
transaccionesRouter.get('/', async (req: Request, res: Response) => {
  const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit    = Math.min(200, parseInt(req.query.limit as string) || 50);
  const desde    = req.query.desde    as string | undefined;
  const hasta    = req.query.hasta    as string | undefined;
  const categoria = req.query.categoria as string | undefined;
  const canal    = req.query.canal    as string | undefined;
  const tipo     = req.query.tipo     as string | undefined;
  const fraude   = req.query.fraude !== undefined
    ? req.query.fraude === 'true'
    : undefined;

  res.json(await transaccionesService.getAll({ page, limit, desde, hasta, categoria, canal, fraude, tipo }));
});

/**
 * @swagger
 * /api/v1/transacciones/{id}:
 *   get:
 *     summary: Detalle de una transacción
 *     tags: [Transacciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transacción encontrada
 *       404:
 *         description: No encontrada
 */
transaccionesRouter.get('/:id', async (req: Request, res: Response) => {
  res.json(await transaccionesService.getById(req.params.id as string));
});
