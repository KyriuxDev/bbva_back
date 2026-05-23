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
};
