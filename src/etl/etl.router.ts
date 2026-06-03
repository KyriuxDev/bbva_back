import { Router } from 'express';
import { etlService } from './etl.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const etlRouter = Router();

etlRouter.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: ETL
 *   description: Datos analíticos del pipeline ETL — Detección de Fraude
 */

/**
 * @swagger
 * /api/v1/etl/resumen:
 *   get:
 *     summary: Resumen general del análisis de fraude
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Totales, tasa de fraude y montos
 */
etlRouter.get('/resumen', async (req, res, next) => {
  try {
    res.json(await etlService.getResumen());
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/fraude-por-categoria:
 *   get:
 *     summary: Fraude agrupado por categoría de transacción
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 */
etlRouter.get('/fraude-por-categoria', async (req, res, next) => {
  try {
    res.json(await etlService.getFraudePorCategoria());
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/fraude-por-canal:
 *   get:
 *     summary: Fraude agrupado por canal (App, Cajero, Web, Sucursal)
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 */
etlRouter.get('/fraude-por-canal', async (req, res, next) => {
  try {
    res.json(await etlService.getFraudePorCanal());
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/fraude-por-mes:
 *   get:
 *     summary: Tendencia mensual de fraude (36 meses)
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 */
etlRouter.get('/fraude-por-mes', async (req, res, next) => {
  try {
    res.json(await etlService.getFraudePorMes());
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/alertas-fraude:
 *   get:
 *     summary: Lista paginada de alertas de fraude enriquecidas
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
etlRouter.get('/alertas-fraude', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    res.json(await etlService.getAlertasFraude(page, limit));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/fraude-geografico:
 *   get:
 *     summary: Clusters de fraude agrupados por coordenada geográfica
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 */
etlRouter.get('/fraude-geografico', async (_req, res, next) => {
  try { res.json(await etlService.getFraudeGeografico()); }
  catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/etl/fraude-por-comercio:
 *   get:
 *     summary: Top 20 comercios con mayor número de fraudes detectados
 *     tags: [ETL]
 *     security: [{ bearerAuth: [] }]
 */
etlRouter.get('/fraude-por-comercio', async (_req, res, next) => {
  try { res.json(await etlService.getFraudePorComercio()); }
  catch (e) { next(e); }
});

etlRouter.get('/resumen-periodo', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query as { desde: string; hasta: string };
    if (!desde || !hasta) { res.status(400).json({ message: 'Faltan parámetros' }); return; }
    res.json(await etlService.getResumenPeriodo(desde, hasta));
  } catch (e) { next(e); }
});

