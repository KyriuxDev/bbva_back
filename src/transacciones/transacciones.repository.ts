import { prisma } from '../prisma';

export interface TransaccionesFiltros {
  page:       number;
  limit:      number;
  desde?:     string;
  hasta?:     string;
  categoria?: string;
  canal?:     string;
  fraude?:    boolean;
  tipo?:      string;
}

export const transaccionesRepository = {
  findAll: async ({ page, limit, desde, hasta, categoria, canal, fraude, tipo }: TransaccionesFiltros) => {
    const skip = (page - 1) * limit;

    const where = {
      ...(desde    && { fecha: { gte: new Date(desde) } }),
      ...(hasta    && { fecha: { lte: new Date(hasta) } }),
      ...(desde && hasta && { fecha: { gte: new Date(desde), lte: new Date(hasta) } }),
      ...(categoria        && { categoria }),
      ...(canal            && { canal }),
      ...(fraude !== undefined && { esFraudePotencial: fraude }),
      ...(tipo   && { tipo }),
    };

    const [data, total] = await Promise.all([
      prisma.transaccion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: {
          cuenta: { select: { idCliente: true, nombre: true, apellidoPaterno: true } },
        },
      }),
      prisma.transaccion.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  findById: (id: string) =>
    prisma.transaccion.findUnique({
      where: { idTransaccion: id },
      include: {
        cuenta: { select: { idCliente: true, nombre: true, apellidoPaterno: true } },
      },
    }),
};
