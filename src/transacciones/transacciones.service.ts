import { transaccionesRepository, TransaccionesFiltros } from './transacciones.repository';

export const transaccionesService = {
  getAll: (filtros: TransaccionesFiltros) => transaccionesRepository.findAll(filtros),

  getById: async (id: string) => {
    const t = await transaccionesRepository.findById(id);
    if (!t) throw Object.assign(new Error('Transacción no encontrada'), { statusCode: 404 });
    return t;
  },
};
