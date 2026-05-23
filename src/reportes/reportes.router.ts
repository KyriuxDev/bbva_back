import { Router, Request, Response } from 'express';
import { reportesService } from './reportes.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const reportesRouter = Router();
reportesRouter.use(authMiddleware);

/**
 * @swagger
 * /api/v1/reportes/kpis:
 *   get:
 *     summary: Genera y descarga el reporte PDF de KPIs y debilidades
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
reportesRouter.get('/kpis', async (req: Request, res: Response) => {
  await reportesService.generarReporteKPIs(res);
});
