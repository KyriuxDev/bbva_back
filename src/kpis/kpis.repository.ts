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
      prisma.$queryRaw<[{ pct: number }]>`
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE estatus_prestamo = 'Vencido') / COUNT(*), 2) AS pct
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
};