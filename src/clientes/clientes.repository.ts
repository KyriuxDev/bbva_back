import { prisma } from '../prisma';

export interface ClientesFiltros {
  page:     number;
  limit:    number;
  nombre?:  string;
  segmento?: string;
  riesgo?:  string;
}

export const clientesRepository = {
  findAll: async ({ page, limit, nombre, segmento, riesgo }: ClientesFiltros) => {
    const skip = (page - 1) * limit;

    const where = {
      ...(nombre && {
        OR: [
          { nombre:          { contains: nombre, mode: 'insensitive' as const } },
          { apellidoPaterno: { contains: nombre, mode: 'insensitive' as const } },
        ],
      }),
      ...(segmento && { openData: { segmentoCliente: segmento } }),
      ...(riesgo   && { openData: { nivelRiesgo: riesgo } }),
    };

    const [data, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { apellidoPaterno: 'asc' },
        include: {
          openData:        true,
          datosPersonales: { select: { email: true, ciudad: true, estado: true } },
        },
      }),
      prisma.cliente.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  findById: (id: string) =>
    prisma.cliente.findUnique({
      where: { idCliente: id },
      include: {
        datosPersonales: true,
        datosNegocio:    true,
        openData:        true,
      },
    }),

  findCuentas: (id: string) =>
    prisma.cuenta.findMany({
      where:   { idCliente: id },
      orderBy: { fechaApertura: 'desc' },
    }),

  findTransacciones: (id: string, limit = 50) =>
    prisma.transaccion.findMany({
      where:   { idCliente: id },
      orderBy: { fecha: 'desc' },
      take:    limit,
    }),

  findPrestamos: (id: string) =>
    prisma.prestamo.findMany({
      where:   { idCliente: id },
      orderBy: { fechaOtorgamiento: 'desc' },
    }),

  findTarjetas: (id: string) =>
    prisma.tarjeta.findMany({ where: { idCliente: id } }),

  findMetasAhorro: (id: string) =>
    prisma.metaAhorro.findMany({
      where:   { idCliente: id },
      orderBy: { fechaObjetivo: 'asc' },
    }),
};
