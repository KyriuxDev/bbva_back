// Servicio de KPIs.
// Transforma los datos crudos del repositorio y genera el análisis de debilidades.

import { kpisRepository } from './kpis.repository';

// Convierte BigInt y Decimal a tipos nativos de JS para que JSON.stringify no falle
const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_: string, v: unknown) => (typeof v === 'bigint' ? Number(v) : v)));

const UMBRALES = {
  fraude:            5,   // % de transacciones con fraude potencial
  cobros:           10,   // % de cobros que exceden límite legal
  cuentasCanceladas: 20,  // % de cuentas canceladas
  prestamosVencidos: 15,  // % de préstamos vencidos
  metasFallidas:    30,   // % de metas de ahorro fallidas
};

function generarSoluciones(
  debilidades: Awaited<ReturnType<typeof kpisRepository.debilidades>>,
) {
  const soluciones: {
    area:      string;
    problema:  string;
    solucion:  string;
    prioridad: 'Alta' | 'Media' | 'Baja';
  }[] = [];

  if (debilidades.porcentajeFraudePotencial > UMBRALES.fraude) {
    soluciones.push({
      area:      'Seguridad',
      problema:  `${debilidades.porcentajeFraudePotencial}% de transacciones con riesgo de fraude`,
      solucion:  'Implementar autenticación de dos factores y revisar reglas del motor antifraude',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeCobrosExcedidos > UMBRALES.cobros) {
    soluciones.push({
      area:      'Cumplimiento',
      problema:  `${debilidades.porcentajeCobrosExcedidos}% de cobros exceden el límite legal`,
      solucion:  'Auditar el catálogo de comisiones y alinear tarifas con la circular CNBV vigente',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeCuentasCanceladas > UMBRALES.cuentasCanceladas) {
    soluciones.push({
      area:      'Retención',
      problema:  `${debilidades.porcentajeCuentasCanceladas}% de cuentas canceladas`,
      solucion:  'Lanzar programa de reactivación con beneficios diferenciados por segmento',
      prioridad: 'Media',
    });
  }

  if (debilidades.porcentajePrestamosVencidos > UMBRALES.prestamosVencidos) {
    soluciones.push({
      area:      'Cartera',
      problema:  `${debilidades.porcentajePrestamosVencidos}% de préstamos vencidos`,
      solucion:  'Reforzar proceso de cobranza preventiva y ofrecer reestructuración anticipada',
      prioridad: 'Alta',
    });
  }

  if (debilidades.porcentajeMetasFallidas > UMBRALES.metasFallidas) {
    soluciones.push({
      area:      'Ahorro',
      problema:  `${debilidades.porcentajeMetasFallidas}% de metas de ahorro fallidas`,
      solucion:  'Enviar recordatorios automáticos y ofrecer microcréditos puente para completar metas',
      prioridad: 'Baja',
    });
  }

  return soluciones;
}

export const kpisService = {

  // ── Existentes ────────────────────────────────────────────────────────────

  getResumen: async () => serialize(await kpisRepository.resumenGeneral()),

  getClientesPorSegmento:     async () => serialize(await kpisRepository.clientesPorSegmento()),
  getClientesPorGenero:       async () => serialize(await kpisRepository.clientesPorGenero()),

  getTransaccionesPorCategoria: async () => serialize(await kpisRepository.transaccionesPorCategoria()),
  getTransaccionesPorCanal:     async () => serialize(await kpisRepository.transaccionesPorCanal()),
  getTendencia12Meses:          async () => serialize(await kpisRepository.tendenciaTransacciones12Meses()),

  getPrestamosPorTipo:    async () => serialize(await kpisRepository.prestamosPorTipo()),
  getSaldoPorTipoCuenta:  async () => serialize(await kpisRepository.saldoPorTipoCuenta()),
  getDistribucionScore:   async () => serialize(await kpisRepository.distribucionScoreCrediticio()),
  getCobrosExcedidos:     async () => serialize(await kpisRepository.cobrosExcedidosPorTipo()),

  getDebilidades: async () => {
    const debilidades = await kpisRepository.debilidades();
    const soluciones  = generarSoluciones(debilidades);
    return { debilidades: serialize(debilidades), soluciones };
  },

  // ── Nuevos ────────────────────────────────────────────────────────────────

  // Pagos
  getPagosPorEstatus: async () => serialize(await kpisRepository.pagosPorEstatus()),
  getPagosPorCanal:   async () => serialize(await kpisRepository.pagosPorCanal()),

  // Seguros & Ahorro
  getSegurosPorEstatus: async () => serialize(await kpisRepository.segurosPorEstatus()),

  getPrimaAnual: async () => {
    const rows = await kpisRepository.primaAnualResumen();
    // primaAnualResumen devuelve un array de 1 fila — aplanamos a objeto
    const row = rows[0];
    if (!row) return { prima_promedio: 0, prima_total: 0, total_polizas: 0 };
    return serialize(row);
  },

  // Comunicación
  getNotificacionesPorEstatus: async () => serialize(await kpisRepository.notificacionesPorEstatus()),
  getNotificacionesPorCanal:   async () => serialize(await kpisRepository.notificacionesPorCanal()),

  // Captación por sucursal
  getCuentasPorSucursal: async () => serialize(await kpisRepository.cuentasPorSucursal()),

  // Cross-selling nómina
  getNominaResumen: async () => {
    const rows = await kpisRepository.nominaResumen();
    const row  = rows[0];
    if (!row) {
      return {
        total_empresas:         0,
        con_nomina_bbva:        0,
        sin_nomina_bbva:        0,
        porcentaje_penetracion: 0,
      };
    }
    return serialize(row);
  },

  // Tarjetas de crédito
  getUtilizacionCredito: async () =>
    serialize(await kpisRepository.utilizacionCredito()),
 
  getUtilizacionCreditoResumen: async () => {
    const rows = await kpisRepository.utilizacionCreditoResumen();
    const row  = rows[0];
    if (!row) return { utilizacion_global: 0, total_tarjetas: 0, saldo_total: 0, limite_total: 0 };
    return serialize(row);
  },
 
  getMorosidadTarjetas: async () =>
    serialize(await kpisRepository.morosidadTarjetas()),
 
  getMorosidadTarjetasResumen: async () => {
    const rows = await kpisRepository.morosidadTarjetasResumen();
    const row  = rows[0];
    if (!row) return { total_activas: 0, total_morosas: 0, tasa_morosidad: 0 };
    return serialize(row);
  },
 
  // Préstamos
  getTasaInteresPrestamos: async () =>
    serialize(await kpisRepository.tasaInteresPrestamos()),
 
  // Metas de ahorro
  getMetasAhorroPorEstatus: async () =>
    serialize(await kpisRepository.metasAhorroPorEstatus()),
 
  getMetasAhorroProgreso: async () => {
    const rows = await kpisRepository.metasAhorroProgreso();
    const row  = rows[0];
    if (!row) return { progreso_promedio: 0, total_activas: 0, monto_objetivo_total: 0, monto_actual_total: 0 };
    return serialize(row);
  },
 
  getResumenPeriodo: async (desde: string, hasta: string) => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return serialize(await kpisRepository.resumenPeriodo(d, h));
  },
 
  getClientesNuevosPeriodo: async (desde: string, hasta: string) => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return kpisRepository.clientesNuevosPeriodo(d, h);
  },
 
  getPrestamosPeriodo: async (desde: string, hasta: string) => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return serialize(await kpisRepository.prestamosPeriodo(d, h));
  },
 
  getCanalPeriodo: async (desde: string, hasta: string) => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return serialize(await kpisRepository.canalPeriodo(d, h));
  },
  
};