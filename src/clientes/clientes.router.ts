import { Router, Request, Response } from 'express';
import { clientesService } from './clientes.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const clientesRouter = Router();
clientesRouter.use(authMiddleware);

/**
 * @swagger
 * /api/v1/clientes:
 *   get:
 *     summary: Listar clientes con paginación y filtros
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: nombre
 *         schema: { type: string }
 *       - in: query
 *         name: segmento
 *         schema: { type: string }
 *       - in: query
 *         name: riesgo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada de clientes
 */
clientesRouter.get('/', async (req: Request, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
  const nombre   = req.query.nombre   as string | undefined;
  const segmento = req.query.segmento as string | undefined;
  const riesgo   = req.query.riesgo   as string | undefined;

  res.json(await clientesService.getAll({ page, limit, nombre, segmento, riesgo }));
});

/**
 * @swagger
 * /api/v1/clientes/{id}:
 *   get:
 *     summary: Perfil completo de un cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cliente con datos personales, negocio y open data
 *       404:
 *         description: Cliente no encontrado
 */
clientesRouter.get('/:id', async (req: Request, res: Response) => {
  res.json(await clientesService.getById(req.params.id as string));
});

/** @swagger
 * /api/v1/clientes/{id}/cuentas:
 *   get:
 *     summary: Cuentas del cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
clientesRouter.get('/:id/cuentas', async (req: Request, res: Response) => {
  res.json(await clientesService.getCuentas(req.params.id as string));
});

/** @swagger
 * /api/v1/clientes/{id}/transacciones:
 *   get:
 *     summary: Últimas transacciones del cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 */
clientesRouter.get('/:id/transacciones', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(await clientesService.getTransacciones(req.params.id as string, limit));
});

/** @swagger
 * /api/v1/clientes/{id}/prestamos:
 *   get:
 *     summary: Préstamos del cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 */
clientesRouter.get('/:id/prestamos', async (req: Request, res: Response) => {
  res.json(await clientesService.getPrestamos(req.params.id as string));
});

/** @swagger
 * /api/v1/clientes/{id}/tarjetas:
 *   get:
 *     summary: Tarjetas del cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 */
clientesRouter.get('/:id/tarjetas', async (req: Request, res: Response) => {
  res.json(await clientesService.getTarjetas(req.params.id as string));
});

/** @swagger
 * /api/v1/clientes/{id}/metas-ahorro:
 *   get:
 *     summary: Metas de ahorro del cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 */
clientesRouter.get('/:id/metas-ahorro', async (req: Request, res: Response) => {
  res.json(await clientesService.getMetasAhorro(req.params.id as string));
});
