import { Router, Request, Response } from 'express';
import { reportesService, OpcionesReporte } from './reportes.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const reportesRouter = Router();
reportesRouter.use(authMiddleware);

/**
 * @swagger
 * /api/v1/reportes/kpis:
 *   get:
 *     summary: Genera y descarga el reporte PDF de KPIs, fraude, gráficas y debilidades
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: kpis
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Incluir sección de KPIs y tablas (default true)
 *       - in: query
 *         name: fraude
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Incluir sección de análisis de fraude (default true)
 *       - in: query
 *         name: graficas
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Incluir páginas de gráficas y visualizaciones (default true)
 *       - in: query
 *         name: debilidades
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Incluir sección de indicadores de riesgo (default true)
 *       - in: query
 *         name: recomendaciones
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Incluir sección de soluciones recomendadas (default true)
 *     responses:
 *       200:
 *         description: Archivo PDF generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autorizado
 */
reportesRouter.get('/kpis', async (req: Request, res: Response) => {
  const opciones: OpcionesReporte = {
    kpis:            req.query.kpis            !== 'false',
    fraude:          req.query.fraude          !== 'false',
    graficas:        req.query.graficas        !== 'false',
    debilidades:     req.query.debilidades     !== 'false',
    recomendaciones: req.query.recomendaciones !== 'false',
  };
  await reportesService.generarReporteKPIs(res, opciones);
});
