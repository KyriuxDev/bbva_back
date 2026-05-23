// Servicio de KPIs.
// Transforma los datos crudos del repositorio y genera el análisis de debilidades.

import { kpisRepository } from './kpis.repository';

// Convierte BigInt a Number para que JSON.stringify no falle
const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

const UMBRALES = {
  fraude:           5,   // % de transacciones con fraude potencial
  cobros:           10,  // % de cobros que exceden límite legal
  cuentasCanceladas: 20, // % de cuentas canceladas
  prestamosVencidos: 15, // % de préstamos vencidos
  metasFallidas:    30,  // % de metas de ahorro fallidas
};

function generarSoluciones(debilidades: Awaited<ReturnType<typeof kpisRepository.debilidades>>) {
  const soluciones: { area: string; problema: string; solucion: string; prioridad: 'Alta' | 'Media' | 'Baja' }[] = [];

  if (debilidades.porcentajeFraudePotencial > UMBRALES.fraude) {
    soluciones.push({
      area: 'Seguridad',
      problema: `${debilidades.porcentajeFraudePotencial}% de transacciones con riesgo de fraude`,
      solucion: 'Implementar autenticación de dos factores y revisar reglas del motor antifraude',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeCobrosExcedidos > UMBRALES.cobros) {
    soluciones.push({
      area: 'Cumplimiento',
      problema: `${debilidades.porcentajeCobrosExcedidos}% de cobros exceden el límite legal`,
      solucion: 'Auditar el catálogo de comisiones y alinear tarifas con la circular CNBV vigente',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeCuentasCanceladas > UMBRALES.cuentasCanceladas) {
    soluciones.push({
      area: 'Retención',
      problema: `${debilidades.porcentajeCuentasCanceladas}% de cuentas canceladas`,
      solucion: 'Lanzar programa de reactivación con beneficios diferenciados por segmento',
      prioridad: 'Media',
    });
  }

  if (debilidades.porcentajePrestamosVencidos > UMBRALES.prestamosVencidos) {
    soluciones.push({
      area: 'Cartera',
      problema: `${debilidades.porcentajePrestamosVencidos}% de préstamos vencidos`,
      solucion: 'Reforzar proceso de cobranza preventiva y ofrecer reestructuración anticipada',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeMetasFallidas > UMBRALES.metasFallidas) {
    soluciones.push({
      area: 'Ahorro',
      problema: `${debilidades.porcentajeMetasFallidas}% de metas de ahorro fallidas`,
      solucion: 'Enviar recordatorios automáticos y ofrecer microcréditos puente para completar metas',
      prioridad: 'Baja',
    });
  }

  return soluciones;
}

export const kpisService = {
  getResumen: async () => {
    const data = await kpisRepository.resumenGeneral();
    return serialize(data);
  },

  getClientesPorSegmento: async () => serialize(await kpisRepository.clientesPorSegmento()),
  getClientesPorGenero:   async () => serialize(await kpisRepository.clientesPorGenero()),

  getTransaccionesPorCategoria: async () => serialize(await kpisRepository.transaccionesPorCategoria()),
  getTransaccionesPorCanal:     async () => serialize(await kpisRepository.transaccionesPorCanal()),
  getTendencia12Meses:          async () => serialize(await kpisRepository.tendenciaTransacciones12Meses()),

  getPrestamosPorTipo:          async () => serialize(await kpisRepository.prestamosPorTipo()),
  getSaldoPorTipoCuenta:        async () => serialize(await kpisRepository.saldoPorTipoCuenta()),
  getDistribucionScore:         async () => serialize(await kpisRepository.distribucionScoreCrediticio()),
  getCobrosExcedidos:           async () => serialize(await kpisRepository.cobrosExcedidosPorTipo()),

  getDebilidades: async () => {
    const debilidades = await kpisRepository.debilidades();
    const soluciones  = generarSoluciones(debilidades);
    return { debilidades: serialize(debilidades), soluciones };
  },
};
