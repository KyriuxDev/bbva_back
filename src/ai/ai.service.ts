// src/ai/ai.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de IA con contexto histórico completo.
// En lugar de pasar solo snapshots, recopila series temporales anuales,
// tendencias de fraude, distribuciones y comparaciones entre años
// para que el modelo pueda responder preguntas como
// "¿cuántos clientes tuve por año?" o "¿en qué año hubo más fraude?".
// ─────────────────────────────────────────────────────────────────────────────

import { Ollama } from 'ollama';
import { prisma }  from '../prisma';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
});

const MODELO = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';

// ── Helpers ───────────────────────────────────────────────────────────────────

const serialize = <T>(v: T): T =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x)));

const fmt  = (n: number) => Math.round(n).toLocaleString('es-MX');
const fmtM = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B MXN`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M MXN`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K MXN`;
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`;
};

interface MensajeHistorial {
  role:    'user' | 'assistant';
  content: string;
}

// ── Recopilación del contexto ─────────────────────────────────────────────────

async function recopilarContexto(): Promise<string> {

  // ── 1. Cuentas abiertas por año (= proxy de clientes nuevos por año) ────────
  const clientesPorAnio = await prisma.$queryRaw<
    { anio: number; nuevas_cuentas: bigint; cuentas_canceladas: bigint }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_apertura)::int                           AS anio,
      COUNT(*)                                                         AS nuevas_cuentas,
      COUNT(*) FILTER (WHERE estatus = 'Cancelada')                   AS cuentas_canceladas
    FROM cuentas
    WHERE fecha_apertura IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 2. Transacciones por año ────────────────────────────────────────────────
  const txPorAnio = await prisma.$queryRaw<
    { anio: number; total_tx: bigint; monto_total: number; fraudes: bigint; tasa_fraude: number }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha)::int                                    AS anio,
      COUNT(*)                                                         AS total_tx,
      ROUND(SUM(monto)::numeric, 0)::float                            AS monto_total,
      COUNT(*) FILTER (WHERE es_fraude_potencial = true)              AS fraudes,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE es_fraude_potencial = true)
        / NULLIF(COUNT(*), 0)::numeric, 2
      )::float                                                         AS tasa_fraude
    FROM transacciones
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 3. Préstamos otorgados por año ──────────────────────────────────────────
  const prestamosPorAnio = await prisma.$queryRaw<
    { anio: number; total: bigint; monto_total: number; vencidos: bigint }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_otorgamiento)::int                      AS anio,
      COUNT(*)                                                         AS total,
      ROUND(SUM(monto_prestamo)::numeric, 0)::float                  AS monto_total,
      COUNT(*) FILTER (WHERE estatus_prestamo = 'Vencido')           AS vencidos
    FROM prestamos
    WHERE fecha_otorgamiento IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 4. Cobros excedidos por año ─────────────────────────────────────────────
  const cobrosPorAnio = await prisma.$queryRaw<
    { anio: number; total_cobros: bigint; excedidos: bigint; monto_excedido: number }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_cobro)::int                             AS anio,
      COUNT(*)                                                         AS total_cobros,
      COUNT(*) FILTER (WHERE excede_limite = true)                   AS excedidos,
      ROUND(
        SUM(monto_cobro) FILTER (WHERE excede_limite = true)::numeric,
        0
      )::float                                                         AS monto_excedido
    FROM cobros
    WHERE fecha_cobro IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 5. Pagos por año ────────────────────────────────────────────────────────
  const pagosPorAnio = await prisma.$queryRaw<
    { anio: number; total: bigint; monto_total: number; exitosos: bigint }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_pago)::int                              AS anio,
      COUNT(*)                                                         AS total,
      ROUND(SUM(monto_pago)::numeric, 0)::float                      AS monto_total,
      COUNT(*) FILTER (WHERE estatus_pago ILIKE '%exit%')            AS exitosos
    FROM pagos
    WHERE fecha_pago IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 6. Metas de ahorro por año ──────────────────────────────────────────────
  const metasPorAnio = await prisma.$queryRaw<
    { anio: number; total: bigint; completadas: bigint; fallidas: bigint }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_inicio)::int                            AS anio,
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE estatus ILIKE '%complet%')              AS completadas,
      COUNT(*) FILTER (WHERE estatus ILIKE '%fall%')                 AS fallidas
    FROM metas_ahorro
    WHERE fecha_inicio IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 7. Seguros por año ──────────────────────────────────────────────────────
  const segurosPorAnio = await prisma.$queryRaw<
    { anio: number; total: bigint; activos: bigint; prima_total: number }[]
  >`
    SELECT
      EXTRACT(YEAR FROM fecha_inicio)::int                            AS anio,
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE estatus_seguro = 'Activo')              AS activos,
      ROUND(SUM(prima_anual)::numeric, 0)::float                     AS prima_total
    FROM seguros
    WHERE fecha_inicio IS NOT NULL
    GROUP BY anio
    ORDER BY anio ASC
  `;

  // ── 8. Tendencia mensual de fraude (últimos 36 meses del DWH) ──────────────
  const fraudeMensual = await prisma.$queryRaw<
    { año_mes: string; total_fraudes: bigint; monto_total: number }[]
  >`
    SELECT año_mes, total_fraudes, monto_total
    FROM dwh.fraude_por_mes
    ORDER BY año_mes ASC
  `.catch(() => [] as any[]);  // silenciar si dwh no existe aún

  // ── 9. Totales globales actuales ────────────────────────────────────────────
  const [
    totalClientes,
    cuentasActivas,
    saldoTotal,
    prestamosVigentes,
    fraudeTotal,
    cobrosExcedidos,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.cuenta.count({ where: { estatus: 'Activa' } }),
    prisma.cuenta.aggregate({ _sum: { saldo: true }, where: { estatus: 'Activa' } }),
    prisma.prestamo.count({ where: { estatusPrestamo: 'Vigente' } }),
    prisma.transaccion.count({ where: { esFraudePotencial: true } }),
    prisma.cobro.count({ where: { excedeLimite: true } }),
  ]);

  // ── 10. Score crediticio actual ─────────────────────────────────────────────
  const scores = await prisma.$queryRaw<{ rango: string; total: bigint }[]>`
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

  // ── 11. Distribución de clientes por segmento ───────────────────────────────
  const segmentos = await prisma.$queryRaw<{ segmento: string; total: bigint }[]>`
    SELECT segmento_cliente AS segmento, COUNT(*) AS total
    FROM open_data WHERE segmento_cliente IS NOT NULL
    GROUP BY segmento_cliente ORDER BY total DESC
  `;

  // ── Serializar y armar el contexto ──────────────────────────────────────────

  const clientes   = serialize(clientesPorAnio)   as any[];
  const txAnio     = serialize(txPorAnio)          as any[];
  const prestAnio  = serialize(prestamosPorAnio)   as any[];
  const cobrosAnio = serialize(cobrosPorAnio)      as any[];
  const pagosAnio  = serialize(pagosPorAnio)       as any[];
  const metasAnio  = serialize(metasPorAnio)       as any[];
  const segAnio    = serialize(segurosPorAnio)     as any[];
  const fraudeMes  = serialize(fraudeMensual)      as any[];
  const scoresSer  = serialize(scores)             as any[];
  const segsSer    = serialize(segmentos)          as any[];

  // Año con más clientes nuevos
  const anioMaxClientes = clientes.length
    ? clientes.reduce((m, r) => r.nuevas_cuentas > m.nuevas_cuentas ? r : m)
    : null;

  // Año con más fraude
  const anioMaxFraude = txAnio.length
    ? txAnio.reduce((m, r) => r.fraudes > m.fraudes ? r : m)
    : null;

  // ── Construir el sistema prompt ─────────────────────────────────────────────

  const clientesTabla = clientes.map(r =>
    `  ${r.anio}: ${fmt(r.nuevas_cuentas)} cuentas nuevas, ${fmt(r.cuentas_canceladas)} canceladas`
  ).join('\n');

  const txTabla = txAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total_tx)} transacciones (${fmtM(r.monto_total)}) | fraudes: ${fmt(r.fraudes)} (${r.tasa_fraude}%)`
  ).join('\n');

  const prestTabla = prestAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total)} préstamos (${fmtM(r.monto_total)}) | vencidos: ${fmt(r.vencidos)}`
  ).join('\n');

  const cobrosTabla = cobrosAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total_cobros)} cobros totales | excedidos: ${fmt(r.excedidos)} (${fmtM(r.monto_excedido ?? 0)})`
  ).join('\n');

  const pagosTabla = pagosAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total)} pagos (${fmtM(r.monto_total)}) | exitosos: ${fmt(r.exitosos)}`
  ).join('\n');

  const metasTabla = metasAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total)} metas | completadas: ${fmt(r.completadas)} | fallidas: ${fmt(r.fallidas)}`
  ).join('\n');

  const segurosTabla = segAnio.map(r =>
    `  ${r.anio}: ${fmt(r.total)} pólizas | activas: ${fmt(r.activos)} | prima total: ${fmtM(r.prima_total ?? 0)}`
  ).join('\n');

  const fraudeMesTabla = fraudeMes.length
    ? fraudeMes.slice(-24).map(r =>    // últimos 24 meses para no inflar demasiado
        `  ${r.año_mes}: ${fmt(r.total_fraudes)} fraudes (${fmtM(r.monto_total)})`
      ).join('\n')
    : '  (sin datos de tendencia mensual)';

  const scoresTabla = scoresSer.map(r =>
    `  ${r.rango}: ${fmt(r.total)} clientes`
  ).join('\n');

  const segsTabla = segsSer.map(r =>
    `  ${r.segmento}: ${fmt(r.total)} clientes`
  ).join('\n');

  return `
Eres un analista financiero senior especializado en banca retail mexicana.
Tienes acceso a datos históricos del sistema BBVA México (${clientes.map(r => r.anio).join(', ')}).
Responde SIEMPRE en español. Sé conciso, accionable y cita los números exactos del contexto.
Si te preguntan algo fuera del ámbito bancario/financiero, redirige amablemente.

════════════════════════════════════════════════════════════
RESUMEN GLOBAL ACTUAL
════════════════════════════════════════════════════════════
Clientes registrados:    ${fmt(totalClientes)}
Cuentas activas:         ${fmt(cuentasActivas)}
Saldo total cuentas:     ${fmtM(Number(saldoTotal._sum.saldo ?? 0))}
Préstamos vigentes:      ${fmt(prestamosVigentes)}
Fraudes potenciales:     ${fmt(fraudeTotal)}
Cobros excedidos:        ${fmt(cobrosExcedidos)}

════════════════════════════════════════════════════════════
CUENTAS NUEVAS Y CANCELADAS POR AÑO
════════════════════════════════════════════════════════════
${clientesTabla}
${anioMaxClientes ? `→ Mayor captación: ${anioMaxClientes.anio} con ${fmt(anioMaxClientes.nuevas_cuentas)} cuentas nuevas` : ''}

════════════════════════════════════════════════════════════
TRANSACCIONES Y FRAUDE POR AÑO
════════════════════════════════════════════════════════════
${txTabla}
${anioMaxFraude ? `→ Año más crítico en fraude: ${anioMaxFraude.anio} (${fmt(anioMaxFraude.fraudes)} casos, ${anioMaxFraude.tasa_fraude}%)` : ''}

════════════════════════════════════════════════════════════
TENDENCIA MENSUAL DE FRAUDE (últimos 24 meses del DWH)
════════════════════════════════════════════════════════════
${fraudeMesTabla}

════════════════════════════════════════════════════════════
PRÉSTAMOS OTORGADOS POR AÑO
════════════════════════════════════════════════════════════
${prestTabla}

════════════════════════════════════════════════════════════
COBROS POR AÑO
════════════════════════════════════════════════════════════
${cobrosTabla}

════════════════════════════════════════════════════════════
PAGOS POR AÑO
════════════════════════════════════════════════════════════
${pagosTabla}

════════════════════════════════════════════════════════════
METAS DE AHORRO POR AÑO
════════════════════════════════════════════════════════════
${metasTabla}

════════════════════════════════════════════════════════════
SEGUROS POR AÑO
════════════════════════════════════════════════════════════
${segurosTabla}

════════════════════════════════════════════════════════════
SCORE CREDITICIO (distribución actual)
════════════════════════════════════════════════════════════
${scoresTabla}

════════════════════════════════════════════════════════════
SEGMENTOS DE CLIENTES (distribución actual)
════════════════════════════════════════════════════════════
${segsTabla}
`.trim();
}

// ── Servicio exportado ────────────────────────────────────────────────────────

export const aiService = {

  chat: async (mensaje: string, historial: MensajeHistorial[]) => {
    const sistema = await recopilarContexto();

    const messages = [
      { role: 'system' as const, content: sistema },
      ...historial.map(h => ({
        role:    h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: mensaje },
    ];

    const response = await ollama.chat({
      model:    MODELO,
      messages,
      options: {
        temperature: 0.2,   // más determinista para análisis con números exactos
        num_predict: 768,   // más tokens para respuestas con tablas/comparaciones
      },
    });

    return {
      respuesta: response.message.content,
      modelo:    MODELO,
    };
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      const list = await ollama.list();
      return list.models.length > 0;
    } catch {
      return false;
    }
  },

  listarModelos: async () => {
    const list = await ollama.list();
    return list.models.map(m => m.name);
  },
};