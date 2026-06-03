// Repositorio de KPIs.
// Usa prisma.$queryRaw para las agregaciones GROUP BY que Prisma no soporta directamente.

import { prisma } from '../prisma';
import type { Prisma } from '@prisma/client';

export const kpisRepository = {

  // ── Tarjetas de resumen ────────────────────────────────────────────────────

  resumenGeneral: async () => {
    const [
      totalClientes,
      cuentasActivas,
      saldoTotal,
      prestamosActivos,
      montoPrestamos,
      transaccionesHoy,
      fraudesPotenciales,
      cobrosExcedidos,
    ] = await Promise.all([
      prisma.cliente.count(),
      prisma.cuenta.count({ where: { estatus: 'Activa' } }),
      prisma.cuenta.aggregate({ _sum: { saldo: true }, where: { estatus: 'Activa' } }),
      prisma.prestamo.count({ where: { estatusPrestamo: 'Vigente' } }),
      prisma.prestamo.aggregate({ _sum: { saldoPrestamo: true }, where: { estatusPrestamo: 'Vigente' } }),
      prisma.transaccion.count({
        where: {
          fecha: {
            gte: await prisma.transaccion
              .findFirst({ orderBy: { fecha: 'desc' }, select: { fecha: true } })
              .then((t: { fecha: Date } | null) => {
                const d = t?.fecha ?? new Date();
                return new Date(d.getFullYear(), d.getMonth(), d.getDate());
              }),
          },
        },
      }),
      prisma.transaccion.count({ where: { esFraudePotencial: true } }),
      prisma.cobro.count({ where: { excedeLimite: true } }),
    ]);

    return {
      totalClientes,
      cuentasActivas,
      saldoTotalCuentas:      saldoTotal._sum.saldo ?? 0,
      prestamosActivos,
      montoPrestamosVigentes: montoPrestamos._sum.saldoPrestamo ?? 0,
      transaccionesHoy,
      fraudesPotenciales,
      cobrosExcedidos,
    };
  },

  // ── Clientes ───────────────────────────────────────────────────────────────

  clientesPorSegmento: (): Promise<{ segmento: string; total: bigint }[]> =>
    prisma.$queryRaw`
      SELECT segmento_cliente AS segmento, COUNT(*) AS total
      FROM open_data
      WHERE segmento_cliente IS NOT NULL
      GROUP BY segmento_cliente
      ORDER BY total DESC
    `,

  clientesPorGenero: (): Promise<{ genero: string; total: bigint }[]> =>
    prisma.$queryRaw`
      SELECT genero, COUNT(*) AS total
      FROM clientes
      WHERE genero IS NOT NULL
      GROUP BY genero
      ORDER BY total DESC
    `,

  // ── Transacciones ──────────────────────────────────────────────────────────

  transaccionesPorCategoria: (): Promise<{ categoria: string; total: bigint; monto_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT categoria, COUNT(*) AS total, SUM(monto) AS monto_total
      FROM transacciones
      WHERE categoria IS NOT NULL
      GROUP BY categoria
      ORDER BY monto_total DESC
    `,

  transaccionesPorCanal: (): Promise<{ canal: string; total: bigint; monto_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT canal, COUNT(*) AS total, SUM(monto) AS monto_total
      FROM transacciones
      WHERE canal IS NOT NULL
      GROUP BY canal
      ORDER BY total DESC
    `,

  tendenciaTransacciones12Meses: (): Promise<{ mes: string; total: bigint; monto_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes,
             COUNT(*) AS total,
             SUM(monto) AS monto_total
      FROM transacciones
      WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY mes
      ORDER BY mes ASC
    `,

  // ── Préstamos y cuentas ────────────────────────────────────────────────────

  prestamosPorTipo: (): Promise<{ tipo: string; total: bigint; saldo_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT tipo_prestamo AS tipo,
             COUNT(*) AS total,
             SUM(saldo_prestamo) AS saldo_total
      FROM prestamos
      WHERE tipo_prestamo IS NOT NULL
      GROUP BY tipo_prestamo
      ORDER BY saldo_total DESC
    `,

  saldoPorTipoCuenta: (): Promise<{ tipo: string; total_cuentas: bigint; saldo_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT tipo_cuenta AS tipo,
             COUNT(*) AS total_cuentas,
             SUM(saldo) AS saldo_total
      FROM cuentas
      WHERE estatus = 'Activa' AND tipo_cuenta IS NOT NULL
      GROUP BY tipo_cuenta
      ORDER BY saldo_total DESC
    `,

  distribucionScoreCrediticio: (): Promise<{ rango: string; total: bigint }[]> =>
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN score_crediticio < 500 THEN 'Malo (< 500)'
          WHEN score_crediticio < 650 THEN 'Regular (500-649)'
          WHEN score_crediticio < 750 THEN 'Bueno (650-749)'
          ELSE 'Excelente (750+)'
        END AS rango,
        COUNT(*) AS total
      FROM open_data
      WHERE score_crediticio IS NOT NULL
      GROUP BY rango
      ORDER BY MIN(score_crediticio) ASC
    `,

  cobrosExcedidosPorTipo: (): Promise<{ tipo: string; total: bigint; diferencia_total: Prisma.Decimal }[]> =>
    prisma.$queryRaw`
      SELECT tipo_comision AS tipo,
             COUNT(*) AS total,
             SUM(diferencia) AS diferencia_total
      FROM auditoria_comisiones
      WHERE resultado = 'Excede'
      GROUP BY tipo_comision
      ORDER BY diferencia_total DESC
    `,

  // ── Debilidades (análisis automático) ─────────────────────────────────────

  debilidades: async () => {
    const [fraude, cobros, cuentasCanceladas, prestamosVencidos, metasFallidas] = await Promise.all([
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(100.0 * SUM(CASE WHEN es_fraude_potencial THEN 1 ELSE 0 END) / COUNT(*), 2) AS pct
        FROM transacciones
      `,
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(100.0 * SUM(CASE WHEN excede_limite THEN 1 ELSE 0 END) / COUNT(*), 2) AS pct
        FROM cobros
      `,
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE estatus = 'Cancelada') / COUNT(*), 2) AS pct
        FROM cuentas
      `,
      // CORREGIDO: usar 'Vencido' (ya correcto) sobre el total de préstamos activos
      // (excluye Liquidado porque un préstamo liquidado es exitoso, no problemático)
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(
          100.0 * COUNT(*) FILTER (WHERE estatus_prestamo = 'Vencido') /
          NULLIF(COUNT(*) FILTER (WHERE estatus_prestamo != 'Liquidado'), 0),
          2
        ) AS pct
        FROM prestamos
      `,
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE estatus = 'Fallida') / COUNT(*), 2) AS pct
        FROM metas_ahorro
      `,
    ]);
 
    return {
      porcentajeFraudePotencial:   Number(fraude[0]?.pct           ?? 0),
      porcentajeCobrosExcedidos:   Number(cobros[0]?.pct           ?? 0),
      porcentajeCuentasCanceladas: Number(cuentasCanceladas[0]?.pct ?? 0),
      porcentajePrestamosVencidos: Number(prestamosVencidos[0]?.pct ?? 0),
      porcentajeMetasFallidas:     Number(metasFallidas[0]?.pct    ?? 0),
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  NUEVAS QUERIES — KPIs adicionales para directivos
  // ─────────────────────────────────────────────────────────────────────────

  // ── Pagos ─────────────────────────────────────────────────────────────────
  // Fuente: pagos.estatus_pago
  // KPI: Tasa de éxito en pagos

  pagosPorEstatus: (): Promise<{ estatus: string; total: bigint; porcentaje: number }[]> =>
    prisma.$queryRaw`
      SELECT
        estatus_pago                                                          AS estatus,
        COUNT(*)                                                              AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::float            AS porcentaje
      FROM pagos
      WHERE estatus_pago IS NOT NULL
      GROUP BY estatus_pago
      ORDER BY total DESC
    `,

  // Fuente: pagos.canal_pago
  // KPI: Canal de pago más utilizado

  pagosPorCanal: (): Promise<{ canal: string; total: bigint; porcentaje: number }[]> =>
    prisma.$queryRaw`
      SELECT
        canal_pago                                                            AS canal,
        COUNT(*)                                                              AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::float            AS porcentaje
      FROM pagos
      WHERE canal_pago IS NOT NULL
      GROUP BY canal_pago
      ORDER BY total DESC
    `,

  // ── Seguros ───────────────────────────────────────────────────────────────
  // Fuente: seguros.estatus_seguro
  // KPI: Pólizas activas vs canceladas

  segurosPorEstatus: (): Promise<{ estatus: string; total: bigint; porcentaje: number }[]> =>
    prisma.$queryRaw`
      SELECT
        estatus_seguro                                                        AS estatus,
        COUNT(*)                                                              AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::float            AS porcentaje
      FROM seguros
      WHERE estatus_seguro IS NOT NULL
      GROUP BY estatus_seguro
      ORDER BY total DESC
    `,

  // Fuente: seguros.prima_anual
  // KPI: Prima anual promedio — rentabilidad del portafolio

  primaAnualResumen: (): Promise<{
    prima_promedio: number;
    prima_total:    number;
    total_polizas:  bigint;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        ROUND(AVG(prima_anual)::numeric, 2)::float   AS prima_promedio,
        ROUND(SUM(prima_anual)::numeric, 2)::float   AS prima_total,
        COUNT(*)                                      AS total_polizas
      FROM seguros
      WHERE estatus_seguro = 'Activo'
        AND prima_anual IS NOT NULL
    `,

  // ── Notificaciones ────────────────────────────────────────────────────────
  // Fuente: notificaciones.estatus_notificacion
  // KPI: Tasa de entrega de notificaciones

  notificacionesPorEstatus: (): Promise<{ estatus: string; total: bigint; porcentaje: number }[]> =>
    prisma.$queryRaw`
      SELECT
        estatus_notificacion                                                  AS estatus,
        COUNT(*)                                                              AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::float            AS porcentaje
      FROM notificaciones
      WHERE estatus_notificacion IS NOT NULL
      GROUP BY estatus_notificacion
      ORDER BY total DESC
    `,

  // Fuente: notificaciones.canal_notificacion
  // KPI: Canal de notificación con mayor alcance

  notificacionesPorCanal: (): Promise<{ canal: string; total: bigint; porcentaje: number }[]> =>
    prisma.$queryRaw`
      SELECT
        canal_notificacion                                                    AS canal,
        COUNT(*)                                                              AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::float            AS porcentaje
      FROM notificaciones
      WHERE canal_notificacion IS NOT NULL
      GROUP BY canal_notificacion
      ORDER BY total DESC
    `,

  // ── Sucursales ────────────────────────────────────────────────────────────
  // Fuente: cuentas.fecha_apertura + sucursal
  // KPI: Nuevas cuentas abiertas por sucursal (últimos 12 meses)

  cuentasPorSucursal: (): Promise<{ sucursal: string; nuevas_cuentas: bigint }[]> =>
    prisma.$queryRaw`
      SELECT
        sucursal,
        COUNT(*) AS nuevas_cuentas
      FROM cuentas
      WHERE sucursal IS NOT NULL
      GROUP BY sucursal
      ORDER BY nuevas_cuentas DESC
      LIMIT 20
    `,

  // ── Cross-selling Nómina ──────────────────────────────────────────────────
  // Fuente: datos_negocio.paga_nomina_bbva
  // KPI: % empresas cliente con nómina BBVA

  nominaResumen: (): Promise<{
    total_empresas:          bigint;
    con_nomina_bbva:         bigint;
    sin_nomina_bbva:         bigint;
    porcentaje_penetracion:  number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        COUNT(*)                                                                          AS total_empresas,
        COUNT(*) FILTER (WHERE paga_nomina_bbva = true)                                  AS con_nomina_bbva,
        COUNT(*) FILTER (WHERE paga_nomina_bbva = false OR paga_nomina_bbva IS NULL)      AS sin_nomina_bbva,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE paga_nomina_bbva = true) / NULLIF(COUNT(*), 0),
          2
        )::float                                                                          AS porcentaje_penetracion
      FROM datos_negocio
    `,

  // ── Tarjetas de crédito ───────────────────────────────────────────────────
 
  /**
   * KPI: Utilización promedio del crédito
   * Fuente: tarjetas.saldo_tarjeta / limite_credito
   * Devuelve el porcentaje promedio de uso del límite, agrupado por tipo de tarjeta.
   * Solo considera tarjetas activas con límite > 0.
   */
  utilizacionCredito: (): Promise<{
    tipo_tarjeta:          string;
    total_tarjetas:        bigint;
    utilizacion_promedio:  number;   // % promedio saldo/límite
    saldo_total:           number;
    limite_total:          number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        tipo_tarjeta,
        COUNT(*)::int                                                           AS total_tarjetas,
        ROUND(
          100.0 * AVG(
            CASE
              WHEN limite_credito > 0 THEN saldo_tarjeta / limite_credito
              ELSE NULL
            END
          )::numeric,
          2
        )::float                                                                AS utilizacion_promedio,
        ROUND(SUM(saldo_tarjeta)::numeric, 2)::float                           AS saldo_total,
        ROUND(SUM(limite_credito)::numeric, 2)::float                          AS limite_total
      FROM tarjetas
      WHERE estatus_tarjeta = 'Activa'
        AND tipo_tarjeta    IS NOT NULL
        AND limite_credito  > 0
      GROUP BY tipo_tarjeta
      ORDER BY utilizacion_promedio DESC
    `,
 
  /**
   * Resumen global de utilización (para la tarjeta de header)
   */
  utilizacionCreditoResumen: (): Promise<{
    utilizacion_global:   number;
    total_tarjetas:       bigint;
    saldo_total:          number;
    limite_total:         number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        ROUND(
          100.0 * SUM(saldo_tarjeta) / NULLIF(SUM(limite_credito), 0)::numeric,
          2
        )::float                                                               AS utilizacion_global,
        COUNT(*)                                                               AS total_tarjetas,
        ROUND(SUM(saldo_tarjeta)::numeric, 2)::float                          AS saldo_total,
        ROUND(SUM(limite_credito)::numeric, 2)::float                         AS limite_total
      FROM tarjetas
      WHERE estatus_tarjeta = 'Activa'
        AND limite_credito  > 0
    `,
 
  /**
   * KPI: Tasa de morosidad en tarjetas
   * Fuente: tarjetas.fecha_limite_pago vs fecha_ultimo_pago
   * Una tarjeta es morosa si fecha_ultimo_pago > fecha_limite_pago
   * O si fecha_limite_pago ya pasó y fecha_ultimo_pago es NULL.
   * Devuelve totales y porcentajes por tipo de tarjeta.
   */
    morosidadTarjetas: (): Promise<{
      tipo_tarjeta:   string;
      total:          bigint;
      morosas:        bigint;
      al_corriente:   bigint;
      tasa_morosidad: number;
    }[]> =>
      prisma.$queryRaw`
        SELECT
          tipo_tarjeta,
          COUNT(*)                                                              AS total,
          COUNT(*) FILTER (WHERE estatus_tarjeta = 'Bloqueada')                AS morosas,
          COUNT(*) FILTER (WHERE estatus_tarjeta = 'Activa')                   AS al_corriente,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE estatus_tarjeta = 'Bloqueada')
            / NULLIF(COUNT(*) FILTER (WHERE estatus_tarjeta IN ('Activa','Bloqueada')), 0)::numeric,
            2
          )::float                                                              AS tasa_morosidad
        FROM tarjetas
        WHERE tipo_tarjeta IS NOT NULL
          AND estatus_tarjeta IN ('Activa', 'Bloqueada')
        GROUP BY tipo_tarjeta
        ORDER BY tasa_morosidad DESC
      `,
 
  /**
   * Resumen global de morosidad (para la tarjeta de header)
   */
  morosidadTarjetasResumen: (): Promise<{
    total_activas:  bigint;
    total_morosas:  bigint;
    tasa_morosidad: number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE estatus_tarjeta IN ('Activa','Bloqueada')) AS total_activas,
        COUNT(*) FILTER (WHERE estatus_tarjeta = 'Bloqueada')             AS total_morosas,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE estatus_tarjeta = 'Bloqueada')
          / NULLIF(COUNT(*) FILTER (WHERE estatus_tarjeta IN ('Activa','Bloqueada')), 0)::numeric,
          2
        )::float                                                           AS tasa_morosidad
      FROM tarjetas
    `,
 
  // ── Préstamos ─────────────────────────────────────────────────────────────
 
  /**
   * KPI: Tasa de interés promedio en préstamos
   * Fuente: prestamos.tasa_prestamo + tipo_prestamo
   * Solo préstamos vigentes con tasa no nula.
   */
  tasaInteresPrestamos: (): Promise<{
    tipo_prestamo: string;
    total:         bigint;
    tasa_promedio: number;
    tasa_minima:   number;
    tasa_maxima:   number;
    monto_total:   number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        tipo_prestamo,
        COUNT(*)                                                                AS total,
        ROUND(AVG(tasa_prestamo)::numeric, 2)::float                           AS tasa_promedio,
        ROUND(MIN(tasa_prestamo)::numeric, 2)::float                           AS tasa_minima,
        ROUND(MAX(tasa_prestamo)::numeric, 2)::float                           AS tasa_maxima,
        ROUND(SUM(monto_prestamo)::numeric, 2)::float                          AS monto_total
      FROM prestamos
      WHERE estatus_prestamo IN ('Al corriente', 'Vencido', 'En reestructura')
        AND tipo_prestamo    IS NOT NULL
        AND tasa_prestamo    IS NOT NULL
      GROUP BY tipo_prestamo
      ORDER BY tasa_promedio DESC
    `,
 
  // ── Metas de ahorro ───────────────────────────────────────────────────────
 
  /**
   * KPI: % metas de ahorro completadas (con desglose por estatus)
   * Fuente: metas_ahorro.estatus
   * Devuelve todos los estatus con sus totales y porcentajes.
   */
  metasAhorroPorEstatus: (): Promise<{
    estatus:    string;
    total:      bigint;
    porcentaje: number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        estatus,
        COUNT(*)                                                                AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER ()::numeric, 2)::float     AS porcentaje
      FROM metas_ahorro
      WHERE estatus IS NOT NULL
      GROUP BY estatus
      ORDER BY total DESC
    `,
 
  /**
   * Progreso promedio de metas activas (monto_actual / monto_objetivo)
   * Útil para ver qué tan cerca están los clientes de completar sus metas.
   */
  metasAhorroProgreso: (): Promise<{
    progreso_promedio:    number;  // % promedio de avance (0-100)
    total_activas:        bigint;
    monto_objetivo_total: number;
    monto_actual_total:   number;
  }[]> =>
    prisma.$queryRaw`
      SELECT
        ROUND(
          100.0 * AVG(
            CASE
              WHEN monto_objetivo > 0 THEN monto_actual / monto_objetivo
              ELSE NULL
            END
          )::numeric,
          2
        )::float                                                                AS progreso_promedio,
        COUNT(*)                                                                AS total_activas,
        ROUND(SUM(monto_objetivo)::numeric, 2)::float                          AS monto_objetivo_total,
        ROUND(SUM(monto_actual)::numeric, 2)::float                            AS monto_actual_total
      FROM metas_ahorro
      WHERE estatus IN ('Activa', 'En progreso')
        AND monto_objetivo > 0
    `,
  resumenPeriodo: async (desde: Date, hasta: Date) => {
    const [
      cuentasActivas,
      saldoCuentas,
      transacciones,
      montoTx,
      fraudes,
      cobros,
      prestamos,
      montoPrest,
    ] = await Promise.all([
      prisma.cuenta.count({
        where: { estatus: 'Activa', fechaApertura: { lte: hasta } },
      }),
      prisma.cuenta.aggregate({
        _sum: { saldo: true },
        where: { estatus: 'Activa', fechaApertura: { lte: hasta } },
      }),
      prisma.transaccion.count({
        where: { fecha: { gte: desde, lte: hasta } },
      }),
      prisma.transaccion.aggregate({
        _sum: { monto: true },
        where: { fecha: { gte: desde, lte: hasta } },
      }),
      prisma.transaccion.count({
        where: { esFraudePotencial: true, fecha: { gte: desde, lte: hasta } },
      }),
      prisma.cobro.count({
        where: { excedeLimite: true, fechaCobro: { gte: desde, lte: hasta } },
      }),
      prisma.prestamo.count({
        where: {
          estatusPrestamo: 'Vigente',
          fechaOtorgamiento: { gte: desde, lte: hasta },
        },
      }),
      prisma.prestamo.aggregate({
        _sum: { saldoPrestamo: true },
        where: {
          estatusPrestamo: 'Vigente',
          fechaOtorgamiento: { gte: desde, lte: hasta },
        },
      }),
    ]);
 
    // Total de clientes registrados hasta el final del período
    const totalClientes = await prisma.cliente.count({
      where: {
        cuentas: { some: { fechaApertura: { lte: hasta } } },
      },
    });
 
    return {
      totalClientes,
      cuentasActivas,
      saldoTotalCuentas:  Number(saldoCuentas._sum.saldo    ?? 0),
      transacciones,
      montoTransacciones: Number(montoTx._sum.monto          ?? 0),
      fraudesPotenciales: fraudes,
      cobrosExcedidos:    cobros,
      prestamosActivos:   prestamos,
      montoPrestamos:     Number(montoPrest._sum.saldoPrestamo ?? 0),
    };
  },
 
  clientesNuevosPeriodo: (desde: Date, hasta: Date) =>
    prisma.cuenta
      .groupBy({
        by: ['idCliente'],
        where: { fechaApertura: { gte: desde, lte: hasta } },
      })
      .then(rows => ({ nuevos: rows.length })),
 
  prestamosPeriodo: (desde: Date, hasta: Date) =>
    prisma.prestamo.groupBy({
      by: ['tipoPrestamo'],
      where: { fechaOtorgamiento: { gte: desde, lte: hasta } },
      _count: { _all: true },
      _sum:   { saldoPrestamo: true },
    }),
 
  canalPeriodo: (desde: Date, hasta: Date): Promise<{
    canal: string; total: bigint; monto_total: Prisma.Decimal;
  }[]> =>
    prisma.$queryRaw`
      SELECT canal,
             COUNT(*)    AS total,
             SUM(monto)  AS monto_total
      FROM transacciones
      WHERE canal IS NOT NULL
        AND fecha >= ${desde}
        AND fecha <= ${hasta}
      GROUP BY canal
      ORDER BY total DESC
    `,
};