// Repositorio de KPIs.
// Usa prisma.$queryRaw para las agregaciones GROUP BY que Prisma no soporta directamente.

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

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
        where: { fecha: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.transaccion.count({ where: { esFraudePotencial: true } }),
      prisma.cobro.count({ where: { excedeLimite: true } }),
    ]);

    return {
      totalClientes,
      cuentasActivas,
      saldoTotalCuentas: saldoTotal._sum.saldo ?? 0,
      prestamosActivos,
      montoPrestamosVigentes: montoPrestamos._sum.saldoPrestamo ?? 0,
      transaccionesHoy,
      fraudesPotenciales,
      cobrosExcedidos,
    };
  },

  // ── Gráficas ───────────────────────────────────────────────────────────────

  clientesPorSegmento: (): Promise<{ segmento: string; total: bigint }[]> => {
    return prisma.$queryRaw`
      SELECT segmento_cliente AS segmento, COUNT(*) AS total
      FROM open_data
      WHERE segmento_cliente IS NOT NULL
      GROUP BY segmento_cliente
      ORDER BY total DESC
    `;
  },

  clientesPorGenero: (): Promise<{ genero: string; total: bigint }[]> => {
    return prisma.$queryRaw`
      SELECT genero, COUNT(*) AS total
      FROM clientes
      WHERE genero IS NOT NULL
      GROUP BY genero
      ORDER BY total DESC
    `;
  },

  transaccionesPorCategoria: (): Promise<{ categoria: string; total: bigint; monto_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT categoria, COUNT(*) AS total, SUM(monto) AS monto_total
      FROM transacciones
      WHERE categoria IS NOT NULL
      GROUP BY categoria
      ORDER BY monto_total DESC
    `;
  },

  transaccionesPorCanal: (): Promise<{ canal: string; total: bigint; monto_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT canal, COUNT(*) AS total, SUM(monto) AS monto_total
      FROM transacciones
      WHERE canal IS NOT NULL
      GROUP BY canal
      ORDER BY total DESC
    `;
  },

  tendenciaTransacciones12Meses: (): Promise<{ mes: string; total: bigint; monto_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes,
             COUNT(*) AS total,
             SUM(monto) AS monto_total
      FROM transacciones
      WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY mes
      ORDER BY mes ASC
    `;
  },

  prestamosPorTipo: (): Promise<{ tipo: string; total: bigint; saldo_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT tipo_prestamo AS tipo,
             COUNT(*) AS total,
             SUM(saldo_prestamo) AS saldo_total
      FROM prestamos
      WHERE tipo_prestamo IS NOT NULL
      GROUP BY tipo_prestamo
      ORDER BY saldo_total DESC
    `;
  },

  saldoPorTipoCuenta: (): Promise<{ tipo: string; total_cuentas: bigint; saldo_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT tipo_cuenta AS tipo,
             COUNT(*) AS total_cuentas,
             SUM(saldo) AS saldo_total
      FROM cuentas
      WHERE estatus = 'Activa' AND tipo_cuenta IS NOT NULL
      GROUP BY tipo_cuenta
      ORDER BY saldo_total DESC
    `;
  },

  distribucionScoreCrediticio: (): Promise<{ rango: string; total: bigint }[]> => {
    return prisma.$queryRaw`
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
    `;
  },

  cobrosExcedidosPorTipo: (): Promise<{ tipo: string; total: bigint; diferencia_total: Prisma.Decimal }[]> => {
    return prisma.$queryRaw`
      SELECT tipo_comision AS tipo,
             COUNT(*) AS total,
             SUM(diferencia) AS diferencia_total
      FROM auditoria_comisiones
      WHERE resultado = 'Excede'
      GROUP BY tipo_comision
      ORDER BY diferencia_total DESC
    `;
  },

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
      porcentajeFraudePotencial: Number(fraude[0]?.pct ?? 0),
      porcentajeCobrosExcedidos: Number(cobros[0]?.pct ?? 0),
      porcentajeCuentasCanceladas: Number(cuentasCanceladas[0]?.pct ?? 0),
      porcentajePrestamosVencidos: Number(prestamosVencidos[0]?.pct ?? 0),
      porcentajeMetasFallidas: Number(metasFallidas[0]?.pct ?? 0),
    };
  },
};
