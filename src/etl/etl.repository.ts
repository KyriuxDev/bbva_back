// Repositorio ETL — consulta el schema dwh generado por el pipeline Python
import { prisma } from '../prisma';

export const etlRepository = {

  resumenGeneral: () =>
    prisma.$queryRaw<any[]>`
      SELECT * FROM dwh.resumen_general LIMIT 1
    `,

  fraudePorCategoria: () =>
    prisma.$queryRaw<any[]>`
      SELECT * FROM dwh.fraude_por_categoria ORDER BY total_fraudes DESC
    `,

  fraudePorCanal: () =>
    prisma.$queryRaw<any[]>`
      SELECT * FROM dwh.fraude_por_canal ORDER BY total_fraudes DESC
    `,

  fraudePorMes: () =>
    prisma.$queryRaw<any[]>`
      SELECT * FROM dwh.fraude_por_mes ORDER BY año_mes ASC
    `,

  // Fraude agrupado por coordenada (clusters redondeados a 1 decimal)
  fraudeGeografico: () =>
    prisma.$queryRaw<any[]>`
      SELECT
        ROUND(latitud::numeric, 1)::float    AS lat,
        ROUND(longitud::numeric, 1)::float   AS lng,
        COUNT(*)::int                         AS total_fraudes,
        SUM(monto)::float                     AS monto_total,
        AVG(monto)::float                     AS monto_promedio,
        MODE() WITHIN GROUP (ORDER BY categoria) AS categoria_top,
        MODE() WITHIN GROUP (ORDER BY canal)     AS canal_top
      FROM transacciones
      WHERE es_fraude_potencial = true
        AND latitud  IS NOT NULL
        AND longitud IS NOT NULL
      GROUP BY ROUND(latitud::numeric, 1), ROUND(longitud::numeric, 1)
      ORDER BY total_fraudes DESC
      LIMIT 200
    `,

  // Top comercios con fraude + clientes afectados
  fraudePorComercio: () =>
    prisma.$queryRaw<any[]>`
      SELECT
        comercio,
        categoria,
        COUNT(*)::int                       AS total_fraudes,
        SUM(monto)::float                   AS monto_total,
        AVG(monto)::float                   AS monto_promedio,
        COUNT(DISTINCT id_cliente)::int     AS clientes_afectados,
        MAX(fecha)                          AS ultima_alerta
      FROM transacciones
      WHERE es_fraude_potencial = true
        AND comercio IS NOT NULL
      GROUP BY comercio, categoria
      ORDER BY total_fraudes DESC
      LIMIT 20
    `,

  alertasFraude: (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT * FROM dwh.alertas_fraude
        ORDER BY fecha DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total FROM dwh.alertas_fraude
      `,
    ]);
  },

  resumenPeriodo: (desde: Date, hasta: Date) =>
    prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE es_fraude_potencial = true)                 AS total_fraudes,
        SUM(monto) FILTER (WHERE es_fraude_potencial = true)               AS monto_total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE es_fraude_potencial = true)
          / NULLIF(COUNT(*), 0)::numeric, 2
        )::float                                                            AS tasa_fraude
      FROM transacciones
      WHERE fecha >= ${desde}
        AND fecha <= ${hasta}
    `,
    
};
