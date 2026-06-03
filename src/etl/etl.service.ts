import { etlRepository } from './etl.repository';

const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

export const etlService = {
  getResumen:           async () => serialize((await etlRepository.resumenGeneral())[0]),
  getFraudePorCategoria: async () => serialize(await etlRepository.fraudePorCategoria()),
  getFraudePorCanal:    async () => serialize(await etlRepository.fraudePorCanal()),
  getFraudePorMes:       async () => serialize(await etlRepository.fraudePorMes()),
  getFraudeGeografico:   async () => serialize(await etlRepository.fraudeGeografico()),
  getFraudePorComercio:  async () => serialize(await etlRepository.fraudePorComercio()),

  getAlertasFraude: async (page: number, limit: number) => {
    const [data, countResult] = await etlRepository.alertasFraude(page, limit);
    const total = Number((countResult[0] as any).total);
    return serialize({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  },

  getResumenPeriodo: async (desde: string, hasta: string) => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    const rows = await etlRepository.resumenPeriodo(d, h);
    return serialize(rows[0] ?? { total_fraudes: 0, monto_total: 0, tasa_fraude: 0 });
  },
};
