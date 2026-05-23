import { clientesRepository, ClientesFiltros } from './clientes.repository';

export const clientesService = {
  getAll: (filtros: ClientesFiltros) => clientesRepository.findAll(filtros),

  getById: async (id: string) => {
    const cliente = await clientesRepository.findById(id);
    if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { statusCode: 404 });
    return cliente;
  },

  getCuentas: async (id: string) => {
    await clientesService.getById(id);
    return clientesRepository.findCuentas(id);
  },

  getTransacciones: async (id: string, limit?: number) => {
    await clientesService.getById(id);
    return clientesRepository.findTransacciones(id, limit);
  },

  getPrestamos: async (id: string) => {
    await clientesService.getById(id);
    return clientesRepository.findPrestamos(id);
  },

  getTarjetas: async (id: string) => {
    await clientesService.getById(id);
    return clientesRepository.findTarjetas(id);
  },

  getMetasAhorro: async (id: string) => {
    await clientesService.getById(id);
    return clientesRepository.findMetasAhorro(id);
  },
};
