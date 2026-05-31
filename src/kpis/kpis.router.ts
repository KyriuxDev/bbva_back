// Endpoints del dashboard de KPIs.
// Todos protegidos con JWT.

import { Router, Request, Response } from 'express';
import { kpisService } from './kpis.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const kpisRouter = Router();
kpisRouter.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
//  ENDPOINTS EXISTENTES
// ─────────────────────────────────────────────────────────────────────────────

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
 *     summary: Distribución de clientes por segmento (gráfica de dona)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array de { segmento, total }
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
 *     responses:
 *       200:
 *         description: Array de { genero, total }
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
 *     responses:
 *       200:
 *         description: Array de { categoria, total, monto_total }
 */
kpisRouter.get('/transacciones-por-categoria', async (_req: Request, res: Response) => {
  res.json(await kpisService.getTransaccionesPorCategoria());
});

/**
 * @swagger
 * /api/v1/kpis/transacciones-por-canal:
 *   get:
 *     summary: Transacciones agrupadas por canal (App, Web, Sucursal…)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array de { canal, total, monto_total }
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
 *     responses:
 *       200:
 *         description: Array de { mes, total, monto_total }
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
 *     responses:
 *       200:
 *         description: Array de { tipo, total, saldo_total }
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
 *     responses:
 *       200:
 *         description: Array de { tipo, total_cuentas, saldo_total }
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
 *     responses:
 *       200:
 *         description: Array de { rango, total }
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
 *     responses:
 *       200:
 *         description: Array de { tipo, total, diferencia_total }
 */
kpisRouter.get('/cobros-excedidos', async (_req: Request, res: Response) => {
  res.json(await kpisService.getCobrosExcedidos());
});

/**
 * @swagger
 * /api/v1/kpis/debilidades:
 *   get:
 *     summary: Análisis automático de debilidades y soluciones priorizadas
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula automáticamente porcentajes clave (fraude, cobros excedidos,
 *       cuentas canceladas, préstamos vencidos, metas fallidas) y genera
 *       recomendaciones con su nivel de prioridad.
 *     responses:
 *       200:
 *         description: >
 *           { debilidades: { porcentajeFraudePotencial, porcentajeCobrosExcedidos,
 *             porcentajeCuentasCanceladas, porcentajePrestamosVencidos, porcentajeMetasFallidas },
 *             soluciones: [{ area, problema, solucion, prioridad }] }
 */
kpisRouter.get('/debilidades', async (_req: Request, res: Response) => {
  res.json(await kpisService.getDebilidades());
});

// ─────────────────────────────────────────────────────────────────────────────
//  NUEVOS ENDPOINTS — KPIs adicionales para directivos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/kpis/pagos-por-estatus:
 *   get:
 *     summary: Tasa de éxito en pagos — exitosos vs fallidos vs pendientes
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Mide la confiabilidad operativa del procesamiento de pagos.
 *       Una tasa de éxito por debajo del 95% indica problemas en la
 *       integración con redes de pago que deben atenderse de inmediato.
 *     responses:
 *       200:
 *         description: Array de { estatus, total, porcentaje }
 */
kpisRouter.get('/pagos-por-estatus', async (_req: Request, res: Response) => {
  res.json(await kpisService.getPagosPorEstatus());
});

/**
 * @swagger
 * /api/v1/kpis/pagos-por-canal:
 *   get:
 *     summary: Canal de pago más utilizado — preferencias del cliente
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Identifica los canales de pago preferidos por los clientes.
 *       Útil para priorizar inversiones en infraestructura y diseñar
 *       campañas de adopción de canales digitales.
 *     responses:
 *       200:
 *         description: Array de { canal, total, porcentaje }
 */
kpisRouter.get('/pagos-por-canal', async (_req: Request, res: Response) => {
  res.json(await kpisService.getPagosPorCanal());
});

/**
 * @swagger
 * /api/v1/kpis/seguros-por-estatus:
 *   get:
 *     summary: Pólizas activas vs canceladas — retención del portafolio de seguros
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Mide la retención del portafolio de seguros.
 *       Una tasa de cancelación superior al 15% requiere
 *       estrategias de retención inmediatas.
 *     responses:
 *       200:
 *         description: Array de { estatus, total, porcentaje }
 */
kpisRouter.get('/seguros-por-estatus', async (_req: Request, res: Response) => {
  res.json(await kpisService.getSegurosPorEstatus());
});

/**
 * @swagger
 * /api/v1/kpis/prima-anual:
 *   get:
 *     summary: Prima anual promedio y total — rentabilidad del portafolio de seguros
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula la prima promedio y el ingreso total generado por las pólizas activas.
 *       Considera únicamente pólizas con estatus 'Activo' y prima_anual no nula.
 *     responses:
 *       200:
 *         description: "{ prima_promedio, prima_total, total_polizas }"
 */
kpisRouter.get('/prima-anual', async (_req: Request, res: Response) => {
  res.json(await kpisService.getPrimaAnual());
});

/**
 * @swagger
 * /api/v1/kpis/notificaciones-por-estatus:
 *   get:
 *     summary: Tasa de entrega de notificaciones — efectividad del canal de comunicación
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Mide qué porcentaje de notificaciones llegan efectivamente al cliente.
 *       Una tasa de entrega inferior al 90% indica problemas de configuración
 *       en tokens push o en las listas de suscriptores.
 *     responses:
 *       200:
 *         description: Array de { estatus, total, porcentaje }
 */
kpisRouter.get('/notificaciones-por-estatus', async (_req: Request, res: Response) => {
  res.json(await kpisService.getNotificacionesPorEstatus());
});

/**
 * @swagger
 * /api/v1/kpis/notificaciones-por-canal:
 *   get:
 *     summary: Canal de notificación con mayor alcance — optimización de comunicación
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Identifica qué canal (Push, SMS, Email, In-App) tiene mayor alcance.
 *       Permite enfocar campañas de retención y comunicados regulatorios
 *       en el canal de mayor impacto.
 *     responses:
 *       200:
 *         description: Array de { canal, total, porcentaje }
 */
kpisRouter.get('/notificaciones-por-canal', async (_req: Request, res: Response) => {
  res.json(await kpisService.getNotificacionesPorCanal());
});

/**
 * @swagger
 * /api/v1/kpis/cuentas-por-sucursal:
 *   get:
 *     summary: Nuevas cuentas abiertas por sucursal en los últimos 12 meses
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Evalúa el desempeño comercial regional mostrando las sucursales
 *       con mayor captación. Top 20 sucursales ordenadas por nuevas cuentas.
 *       Útil para identificar sucursales que necesitan apoyo comercial.
 *     responses:
 *       200:
 *         description: Array de { sucursal, nuevas_cuentas } ordenado desc
 */
kpisRouter.get('/cuentas-por-sucursal', async (_req: Request, res: Response) => {
  res.json(await kpisService.getCuentasPorSucursal());
});

/**
 * @swagger
 * /api/v1/kpis/nomina-resumen:
 *   get:
 *     summary: Penetración de nómina BBVA — % de empresas cliente que pagan nómina con BBVA
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Mide el cross-selling del producto de nómina entre empresas cliente.
 *       La nómina BBVA ancla la relación bancaria y facilita la venta de
 *       otros productos. Las empresas sin nómina BBVA representan oportunidades
 *       activas de captación.
 *     responses:
 *       200:
 *         description: >
 *           { total_empresas, con_nomina_bbva, sin_nomina_bbva, porcentaje_penetracion }
 */
kpisRouter.get('/nomina-resumen', async (_req: Request, res: Response) => {
  res.json(await kpisService.getNominaResumen());
});

// ── TARJETAS DE CRÉDITO ──────────────────────────────────────────────────────
 
/**
 * @swagger
 * /api/v1/kpis/utilizacion-credito:
 *   get:
 *     summary: Utilización promedio del crédito por tipo de tarjeta
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula el porcentaje promedio de uso del límite de crédito
 *       (saldo_tarjeta / limite_credito × 100) para tarjetas activas,
 *       agrupado por tipo de tarjeta.
 *       Una utilización superior al 70% es señal de riesgo para la cartera.
 *     responses:
 *       200:
 *         description: >
 *           Array de { tipo_tarjeta, total_tarjetas, utilizacion_promedio,
 *           saldo_total, limite_total }
 */
kpisRouter.get('/utilizacion-credito', async (_req: Request, res: Response) => {
  res.json(await kpisService.getUtilizacionCredito());
});
 
/**
 * @swagger
 * /api/v1/kpis/utilizacion-credito/resumen:
 *   get:
 *     summary: Resumen global de utilización del crédito
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: >
 *           { utilizacion_global, total_tarjetas, saldo_total, limite_total }
 */
kpisRouter.get('/utilizacion-credito/resumen', async (_req: Request, res: Response) => {
  res.json(await kpisService.getUtilizacionCreditoResumen());
});
 
/**
 * @swagger
 * /api/v1/kpis/morosidad-tarjetas:
 *   get:
 *     summary: Tasa de morosidad en tarjetas de crédito por tipo
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Una tarjeta es morosa cuando fecha_limite_pago < hoy
 *       y (fecha_ultimo_pago IS NULL o fecha_ultimo_pago > fecha_limite_pago).
 *       Agrupa por tipo de tarjeta con totales y tasa de morosidad.
 *       Umbral de alerta recomendado: >5%.
 *     responses:
 *       200:
 *         description: >
 *           Array de { tipo_tarjeta, total, morosas, al_corriente, tasa_morosidad }
 */
kpisRouter.get('/morosidad-tarjetas', async (_req: Request, res: Response) => {
  res.json(await kpisService.getMorosidadTarjetas());
});
 
/**
 * @swagger
 * /api/v1/kpis/morosidad-tarjetas/resumen:
 *   get:
 *     summary: Resumen global de morosidad en tarjetas
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ total_activas, total_morosas, tasa_morosidad }"
 */
kpisRouter.get('/morosidad-tarjetas/resumen', async (_req: Request, res: Response) => {
  res.json(await kpisService.getMorosidadTarjetasResumen());
});
 
// ── PRÉSTAMOS ────────────────────────────────────────────────────────────────
 
/**
 * @swagger
 * /api/v1/kpis/tasa-interes-prestamos:
 *   get:
 *     summary: Tasa de interés promedio en préstamos vigentes por tipo
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula la tasa anual promedio, mínima y máxima para cada tipo de
 *       préstamo vigente. Útil para comparar rentabilidad entre productos
 *       y detectar tasas fuera de mercado (pricing).
 *     responses:
 *       200:
 *         description: >
 *           Array de { tipo_prestamo, total, tasa_promedio, tasa_minima,
 *           tasa_maxima, monto_total }
 */
kpisRouter.get('/tasa-interes-prestamos', async (_req: Request, res: Response) => {
  res.json(await kpisService.getTasaInteresPrestamos());
});
 
// ── METAS DE AHORRO ──────────────────────────────────────────────────────────
 
/**
 * @swagger
 * /api/v1/kpis/metas-ahorro-por-estatus:
 *   get:
 *     summary: Distribución de metas de ahorro por estatus (completadas, activas, fallidas…)
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Muestra el desglose completo de metas de ahorro por estatus,
 *       con totales y porcentajes. Complementa el indicador de debilidades
 *       (porcentajeMetasFallidas) con visibilidad sobre metas completadas.
 *     responses:
 *       200:
 *         description: Array de { estatus, total, porcentaje }
 */
kpisRouter.get('/metas-ahorro-por-estatus', async (_req: Request, res: Response) => {
  res.json(await kpisService.getMetasAhorroPorEstatus());
});
 
/**
 * @swagger
 * /api/v1/kpis/metas-ahorro-progreso:
 *   get:
 *     summary: Progreso promedio de metas de ahorro activas
 *     tags: [KPIs]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Calcula el porcentaje promedio de avance (monto_actual / monto_objetivo)
 *       para metas en estatus Activa o En progreso. Indica qué tan cerca están
 *       los clientes de completar sus objetivos de ahorro.
 *     responses:
 *       200:
 *         description: >
 *           { progreso_promedio, total_activas, monto_objetivo_total,
 *           monto_actual_total }
 */
kpisRouter.get('/metas-ahorro-progreso', async (_req: Request, res: Response) => {
  res.json(await kpisService.getMetasAhorroProgreso());
});
 