// Endpoints del dashboard de KPIs.
// Todos protegidos con JWT.

import { Router, Request, Response } from 'express';
import { kpisService } from './kpis.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const kpisRouter = Router();
kpisRouter.use(authMiddleware);

/**
 * @swagger
 * /api/v1/kpis/resumen:
 *   get:
 *     summary: Tarjetas de resumen general
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Totales de clientes, cuentas, saldo, préstamos, fraudes y cobros excedidos
 */
kpisRouter.get('/resumen', async (_req: Request, res: Response) => {
  res.json(await kpisService.getResumen());
});

/**
 * @swagger
 * /api/v1/kpis/clientes-por-segmento:
 *   get:
 *     summary: Distribución de clientes por segmento (gráfica de pastel)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/clientes-por-segmento', async (_req: Request, res: Response) => {
  res.json(await kpisService.getClientesPorSegmento());
});

/**
 * @swagger
 * /api/v1/kpis/clientes-por-genero:
 *   get:
 *     summary: Distribución de clientes por género
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/clientes-por-genero', async (_req: Request, res: Response) => {
  res.json(await kpisService.getClientesPorGenero());
});

/**
 * @swagger
 * /api/v1/kpis/transacciones-por-categoria:
 *   get:
 *     summary: Transacciones agrupadas por categoría (volumen y monto)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/transacciones-por-categoria', async (_req: Request, res: Response) => {
  res.json(await kpisService.getTransaccionesPorCategoria());
});

/**
 * @swagger
 * /api/v1/kpis/transacciones-por-canal:
 *   get:
 *     summary: Transacciones agrupadas por canal (app, web, sucursal...)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/transacciones-por-canal', async (_req: Request, res: Response) => {
  res.json(await kpisService.getTransaccionesPorCanal());
});

/**
 * @swagger
 * /api/v1/kpis/tendencia:
 *   get:
 *     summary: Tendencia de transacciones en los últimos 12 meses (gráfica de línea)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/tendencia', async (_req: Request, res: Response) => {
  res.json(await kpisService.getTendencia12Meses());
});

/**
 * @swagger
 * /api/v1/kpis/prestamos-por-tipo:
 *   get:
 *     summary: Préstamos agrupados por tipo con saldo total
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/prestamos-por-tipo', async (_req: Request, res: Response) => {
  res.json(await kpisService.getPrestamosPorTipo());
});

/**
 * @swagger
 * /api/v1/kpis/saldo-por-tipo-cuenta:
 *   get:
 *     summary: Saldo total en cuentas activas agrupado por tipo de cuenta
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/saldo-por-tipo-cuenta', async (_req: Request, res: Response) => {
  res.json(await kpisService.getSaldoPorTipoCuenta());
});

/**
 * @swagger
 * /api/v1/kpis/score-crediticio:
 *   get:
 *     summary: Distribución de clientes por rango de score crediticio
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/score-crediticio', async (_req: Request, res: Response) => {
  res.json(await kpisService.getDistribucionScore());
});

/**
 * @swagger
 * /api/v1/kpis/cobros-excedidos:
 *   get:
 *     summary: Comisiones que exceden límite legal, agrupadas por tipo
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 */
kpisRouter.get('/cobros-excedidos', async (_req: Request, res: Response) => {
  res.json(await kpisService.getCobrosExcedidos());
});

/**
 * @swagger
 * /api/v1/kpis/debilidades:
 *   get:
 *     summary: Análisis de debilidades y posibles soluciones
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula automáticamente porcentajes clave (fraude, cobros excedidos,
 *       cuentas canceladas, préstamos vencidos, metas fallidas) y genera
 *       recomendaciones con su nivel de prioridad.
 */
kpisRouter.get('/debilidades', async (_req: Request, res: Response) => {
  res.json(await kpisService.getDebilidades());
});
