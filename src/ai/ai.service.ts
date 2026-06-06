// src/ai/ai.service.ts
// Contexto en lenguaje natural con años correctos por tabla.
// Cuentas/Préstamos/Seguros: 2021-2023 | Txs/Pagos/Cobros/Metas: 2022-2024

import { Ollama } from 'ollama';
import { prisma }  from '../prisma';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
  fetch: (url: any, options?: any) =>
    fetch(url, { ...options, signal: AbortSignal.timeout(10 * 60 * 1000) }),
});

const MODELO = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';

// ── Cache 5 minutos ───────────────────────────────────────────────────────────
let contextCache: { data: string; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const serialize = <T>(v: T): T =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x)));

const fmt  = (n: number) => Math.round(n).toLocaleString('es-MX');
const fmtM = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n/1e9).toFixed(2)}B MXN`;
  if (a >= 1e6) return `$${(n/1e6).toFixed(2)}M MXN`;
  if (a >= 1e3) return `$${(n/1e3).toFixed(1)}K MXN`;
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`;
};
const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`;
const dif = (a: number, b: number) => {
  if (!b) return a > 0 ? 'aumentó 100%' : 'sin cambio';
  const d = ((a - b) / b) * 100;
  return d >= 0 ? `aumentó ${d.toFixed(1)}%` : `bajó ${Math.abs(d).toFixed(1)}%`;
};

interface MensajeHistorial { role: 'user' | 'assistant'; content: string; }

async function recopilarContexto(): Promise<string> {
  if (contextCache && Date.now() - contextCache.timestamp < CACHE_TTL) {
    console.log('📦 Usando contexto cacheado');
    return contextCache.data;
  }

  console.log('🔄 Construyendo contexto completo...');
  const t0 = Date.now();

  // ── Snapshot global ────────────────────────────────────────────────────────
  const [
    totalClientes, cuentasActivas, saldoAgg, prestamosVig, montoPrestAgg,
    fraudeTotal, cobrosExcTotal, tarjetasActivas, segurosActivos, metasActivas,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.cuenta.count({ where: { estatus: 'Activa' } }),
    prisma.cuenta.aggregate({ _sum: { saldo: true }, where: { estatus: 'Activa' } }),
    prisma.prestamo.count({ where: { estatusPrestamo: 'Vigente' } }),
    prisma.prestamo.aggregate({ _sum: { saldoPrestamo: true }, where: { estatusPrestamo: 'Vigente' } }),
    prisma.transaccion.count({ where: { esFraudePotencial: true } }),
    prisma.cobro.count({ where: { excedeLimite: true } }),
    prisma.tarjeta.count({ where: { estatusTarjeta: 'Activa' } }),
    prisma.seguro.count({ where: { estatusSeguro: 'Activo' } }),
    prisma.metaAhorro.count({ where: { estatus: { in: ['Activa', 'En progreso'] } } }),
  ]);

  // ── Queries con años correctos por tabla ───────────────────────────────────
  const [
    txAnio,    // 2022-2024
    ctaAnio,   // 2021-2023
    pagAnio,   // 2022-2024
    prestAnio, // 2021-2023
    segAnio,   // 2021-2023
    metaAnio,  // 2022-2024
    cobrosAnio,// 2022-2024
  ] = await Promise.all([
    // Transacciones: 2022-2024
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha)::int AS anio,
        COUNT(*) AS tx,
        ROUND(SUM(monto)::numeric,0)::float AS monto,
        COUNT(*) FILTER (WHERE es_fraude_potencial=true) AS fraudes,
        ROUND(100.0*COUNT(*) FILTER (WHERE es_fraude_potencial=true)/NULLIF(COUNT(*),0)::numeric,2)::float AS tasa
      FROM transacciones
      WHERE EXTRACT(YEAR FROM fecha) IN (2022,2023,2024)
      GROUP BY anio ORDER BY anio`,

    // Cuentas: 2021-2023
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_apertura)::int AS anio,
        COUNT(*) AS nuevas
      FROM cuentas
      WHERE fecha_apertura IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_apertura) IN (2021,2022,2023)
      GROUP BY anio ORDER BY anio`,

    // Pagos: 2022-2024
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_pago)::int AS anio,
        COUNT(*) AS total,
        ROUND(SUM(monto_pago)::numeric,0)::float AS monto,
        COUNT(*) FILTER (WHERE LOWER(estatus_pago) LIKE '%exit%') AS exitosos
      FROM pagos
      WHERE fecha_pago IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_pago) IN (2022,2023,2024)
      GROUP BY anio ORDER BY anio`,

    // Préstamos: 2021-2023
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_otorgamiento)::int AS anio,
        COUNT(*) AS total,
        ROUND(SUM(monto_prestamo)::numeric,0)::float AS monto,
        COUNT(*) FILTER (WHERE estatus_prestamo='Vencido') AS vencidos
      FROM prestamos
      WHERE fecha_otorgamiento IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_otorgamiento) IN (2021,2022,2023)
      GROUP BY anio ORDER BY anio`,

    // Seguros: 2021-2023
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_inicio)::int AS anio,
        COUNT(*) AS total
      FROM seguros
      WHERE fecha_inicio IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_inicio) IN (2021,2022,2023)
      GROUP BY anio ORDER BY anio`,

    // Metas de ahorro: 2022-2024
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_inicio)::int AS anio,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE LOWER(estatus) LIKE '%complet%') AS completadas,
        COUNT(*) FILTER (WHERE LOWER(estatus) LIKE '%fall%') AS fallidas
      FROM metas_ahorro
      WHERE fecha_inicio IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_inicio) IN (2022,2023,2024)
      GROUP BY anio ORDER BY anio`,

    // Cobros: 2022-2024
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_cobro)::int AS anio,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE excede_limite=true) AS excedidos
      FROM cobros
      WHERE fecha_cobro IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_cobro) IN (2022,2023,2024)
      GROUP BY anio ORDER BY anio`,
  ]);

  // ── Trimestrales: txs 2022-2024, cuentas 2021-2023 ────────────────────────
  const [txTrim, ctaTrim] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha)::int AS anio,
        EXTRACT(QUARTER FROM fecha)::int AS q,
        COUNT(*) AS tx,
        COUNT(*) FILTER (WHERE es_fraude_potencial=true) AS fraudes
      FROM transacciones
      WHERE EXTRACT(YEAR FROM fecha) IN (2023,2024)
      GROUP BY anio,q ORDER BY anio,q`,

    prisma.$queryRaw<any[]>`
      SELECT EXTRACT(YEAR FROM fecha_apertura)::int AS anio,
        EXTRACT(QUARTER FROM fecha_apertura)::int AS q,
        COUNT(*) AS nuevas
      FROM cuentas
      WHERE fecha_apertura IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_apertura) IN (2022,2023)
      GROUP BY anio,q ORDER BY anio,q`,
  ]);

  // ── Mensuales: txs 2023-2024 ──────────────────────────────────────────────
  const txMes = await prisma.$queryRaw<any[]>`
    SELECT EXTRACT(YEAR FROM fecha)::int AS anio,
      EXTRACT(MONTH FROM fecha)::int AS mes,
      COUNT(*) AS tx,
      COUNT(*) FILTER (WHERE es_fraude_potencial=true) AS fraudes
    FROM transacciones
    WHERE EXTRACT(YEAR FROM fecha) IN (2023,2024)
    GROUP BY anio,mes ORDER BY anio,mes`;

  // ── KPIs específicos ───────────────────────────────────────────────────────
  const [
    utilCred, morosidad, pagosEst, pagosCan,
    segurosEst, primaAnual, notiCan, prestTipo,
    metasEst, metasProg, sucursales, nomina,
    scores, segmentos,
    pctFraude, pctCobros, pctCanceladas, pctVencidos, pctMetasFallidas,
  ] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT ROUND(100.0*SUM(saldo_tarjeta)/NULLIF(SUM(limite_credito),0)::numeric,2)::float AS util,
        COUNT(*) AS tarjetas,
        ROUND(SUM(saldo_tarjeta)::numeric,2)::float AS saldo,
        ROUND(SUM(limite_credito)::numeric,2)::float AS limite
      FROM tarjetas WHERE estatus_tarjeta='Activa' AND limite_credito>0`,

    prisma.$queryRaw<any[]>`
      SELECT COUNT(*) FILTER (WHERE estatus_tarjeta IN ('Activa','Bloqueada')) AS activas,
        COUNT(*) FILTER (WHERE estatus_tarjeta='Bloqueada') AS morosas,
        ROUND(100.0*COUNT(*) FILTER (WHERE estatus_tarjeta='Bloqueada')
          /NULLIF(COUNT(*) FILTER (WHERE estatus_tarjeta IN ('Activa','Bloqueada')),0)::numeric,2)::float AS tasa
      FROM tarjetas`,

    prisma.$queryRaw<any[]>`
      SELECT estatus_pago AS est, COUNT(*) AS total,
        ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER(),2)::float AS pct
      FROM pagos WHERE estatus_pago IS NOT NULL GROUP BY est ORDER BY total DESC`,

    prisma.$queryRaw<any[]>`
      SELECT canal_pago AS canal, COUNT(*) AS total,
        ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER(),2)::float AS pct
      FROM pagos WHERE canal_pago IS NOT NULL GROUP BY canal ORDER BY total DESC`,

    prisma.$queryRaw<any[]>`
      SELECT estatus_seguro AS est, COUNT(*) AS total,
        ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER(),2)::float AS pct
      FROM seguros WHERE estatus_seguro IS NOT NULL GROUP BY est ORDER BY total DESC`,

    prisma.$queryRaw<any[]>`
      SELECT ROUND(AVG(prima_anual)::numeric,2)::float AS promedio,
        ROUND(SUM(prima_anual)::numeric,2)::float AS total, COUNT(*) AS polizas
      FROM seguros WHERE estatus_seguro='Activo' AND prima_anual IS NOT NULL`,

    prisma.$queryRaw<any[]>`
      SELECT canal_notificacion AS canal, COUNT(*) AS total,
        ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER(),2)::float AS pct
      FROM notificaciones WHERE canal_notificacion IS NOT NULL GROUP BY canal ORDER BY total DESC`,

    prisma.$queryRaw<any[]>`
      SELECT tipo_prestamo AS tipo, COUNT(*) AS total,
        ROUND(SUM(saldo_prestamo)::numeric,0)::float AS saldo,
        ROUND(AVG(tasa_prestamo)::numeric,2)::float AS tasa,
        COUNT(*) FILTER (WHERE estatus_prestamo='Vencido') AS vencidos
      FROM prestamos WHERE tipo_prestamo IS NOT NULL GROUP BY tipo ORDER BY saldo DESC`,

    prisma.$queryRaw<any[]>`
      SELECT estatus, COUNT(*) AS total,
        ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER()::numeric,2)::float AS pct
      FROM metas_ahorro WHERE estatus IS NOT NULL GROUP BY estatus ORDER BY total DESC`,

    prisma.$queryRaw<any[]>`
      SELECT ROUND(100.0*AVG(CASE WHEN monto_objetivo>0 THEN monto_actual/monto_objetivo ELSE NULL END)::numeric,2)::float AS progreso,
        COUNT(*) AS activas,
        ROUND(SUM(monto_objetivo)::numeric,2)::float AS objetivo,
        ROUND(SUM(monto_actual)::numeric,2)::float AS actual
      FROM metas_ahorro WHERE estatus IN ('Activa','En progreso') AND monto_objetivo>0`,

    prisma.$queryRaw<any[]>`
      SELECT sucursal, COUNT(*) AS cuentas FROM cuentas
      WHERE sucursal IS NOT NULL GROUP BY sucursal ORDER BY cuentas DESC LIMIT 5`,

    prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE paga_nomina_bbva=true) AS con_nomina,
        ROUND(100.0*COUNT(*) FILTER (WHERE paga_nomina_bbva=true)/NULLIF(COUNT(*),0),2)::float AS pct
      FROM datos_negocio`,

    prisma.$queryRaw<any[]>`
      SELECT CASE WHEN score_crediticio<500 THEN 'Malo'
        WHEN score_crediticio<650 THEN 'Regular'
        WHEN score_crediticio<750 THEN 'Bueno'
        ELSE 'Excelente' END AS rango, COUNT(*) AS total
      FROM open_data WHERE score_crediticio IS NOT NULL
      GROUP BY rango ORDER BY MIN(score_crediticio)`,

    prisma.$queryRaw<any[]>`
      SELECT segmento_cliente AS seg, COUNT(*) AS total
      FROM open_data WHERE segmento_cliente IS NOT NULL
      GROUP BY seg ORDER BY total DESC`,

    prisma.$queryRaw<[{pct:number}]>`SELECT ROUND(100.0*SUM(CASE WHEN es_fraude_potencial THEN 1 ELSE 0 END)/COUNT(*),2) AS pct FROM transacciones`,
    prisma.$queryRaw<[{pct:number}]>`SELECT ROUND(100.0*SUM(CASE WHEN excede_limite THEN 1 ELSE 0 END)/COUNT(*),2) AS pct FROM cobros`,
    prisma.$queryRaw<[{pct:number}]>`SELECT ROUND(100.0*COUNT(*) FILTER (WHERE estatus='Cancelada')/COUNT(*),2) AS pct FROM cuentas`,
    prisma.$queryRaw<[{pct:number}]>`SELECT ROUND(100.0*COUNT(*) FILTER (WHERE estatus_prestamo='Vencido')/NULLIF(COUNT(*) FILTER (WHERE estatus_prestamo!='Liquidado'),0),2) AS pct FROM prestamos`,
    prisma.$queryRaw<[{pct:number}]>`SELECT ROUND(100.0*COUNT(*) FILTER (WHERE estatus='Fallida')/COUNT(*),2) AS pct FROM metas_ahorro`,
  ]);

  // ETL con fallback
  const [etlRes, fCanal] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT * FROM dwh.resumen_general LIMIT 1`.catch(()=>[{}]),
    prisma.$queryRaw<any[]>`SELECT * FROM dwh.fraude_por_canal ORDER BY total_fraudes DESC`.catch(()=>[]),
  ]);

  // ── Serializar ─────────────────────────────────────────────────────────────
  const S   = serialize;
  const tA  = S(txAnio)    as any[];
  const cA  = S(ctaAnio)   as any[];
  const pA  = S(pagAnio)   as any[];
  const prA = S(prestAnio) as any[];
  const sA  = S(segAnio)   as any[];
  const mA  = S(metaAnio)  as any[];
  const cob = S(cobrosAnio) as any[];
  const tT  = S(txTrim)    as any[];
  const cT  = S(ctaTrim)   as any[];
  const tM  = S(txMes)     as any[];
  const etl = (S(etlRes)   as any[])[0] ?? {};
  const fC  = S(fCanal)    as any[];
  const u   = (S(utilCred)  as any[])[0] ?? {};
  const mo  = (S(morosidad) as any[])[0] ?? {};
  const pa  = (S(primaAnual) as any[])[0] ?? {};
  const no  = (S(nomina)    as any[])[0] ?? {};
  const mp  = (S(metasProg) as any[])[0] ?? {};

  // Helpers de búsqueda
  const a  = (arr:any[], anio:number) => arr.find(r => r.anio === anio) ?? {};
  const tq = (arr:any[], anio:number, q:number) => arr.find(r => r.anio === anio && r.q === q) ?? {};
  const tm = (arr:any[], anio:number, mes:number) => arr.find(r => r.anio === anio && r.mes === mes) ?? {};

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const QNAMES = ['Q1 (Ene-Mar)','Q2 (Abr-Jun)','Q3 (Jul-Sep)','Q4 (Oct-Dic)'];

  // Año con máximo por tabla
  const maxDe = (arr:any[], campo:string, años:number[]) =>
    años.reduce((max,y) => (a(arr,y)[campo]??0) > (a(arr,max)[campo]??0) ? y : max, años[0]);

  const anioMaxCuentas  = maxDe(cA,  'nuevas',  [2021,2022,2023]);
  const anioMaxTx       = maxDe(tA,  'tx',      [2022,2023,2024]);
  const anioMaxFraudes  = maxDe(tA,  'fraudes', [2022,2023,2024]);
  const anioMaxPagos    = maxDe(pA,  'total',   [2022,2023,2024]);
  const anioMaxPrestamos= maxDe(prA, 'total',   [2021,2022,2023]);
  const anioMaxMetas    = maxDe(mA,  'completadas', [2022,2023,2024]);

  // ── Construir contexto en lenguaje natural ─────────────────────────────────
const ctx = `
Eres un analista financiero senior de BBVA México con acceso a datos reales.
Responde siempre en español usando los números exactos de este contexto.
Si te preguntan por el mejor o peor año, usa los datos aquí presentados.

RESUMEN RÁPIDO DE DATOS CLAVE:
- Cuentas nuevas: 2021=4,552 | 2022=4,603 | 2023=4,609 (más en 2023)
- Transacciones: 2022=${fmt(a(tA,2022).tx??0)} | 2023=${fmt(a(tA,2023).tx??0)} | 2024=${fmt(a(tA,2024).tx??0)}
- Fraudes: 2022=${fmt(a(tA,2022).fraudes??0)} | 2023=${fmt(a(tA,2023).fraudes??0)} | 2024=${fmt(a(tA,2024).fraudes??0)}
- Préstamos nuevos: 2021=${fmt(a(prA,2021).total??0)} | 2022=${fmt(a(prA,2022).total??0)} | 2023=${fmt(a(prA,2023).total??0)}
- Pagos procesados: 2022=${fmt(a(pA,2022).total??0)} | 2023=${fmt(a(pA,2023).total??0)} | 2024=${fmt(a(pA,2024).total??0)}
- Metas completadas: 2022=${fmt(a(mA,2022).completadas??0)} | 2023=${fmt(a(mA,2023).completadas??0)} | 2024=${fmt(a(mA,2024).completadas??0)}
- Seguros nuevos: 2021=${fmt(a(sA,2021).total??0)} | 2022=${fmt(a(sA,2022).total??0)} | 2023=${fmt(a(sA,2023).total??0)}

=== ESTADO ACTUAL DEL SISTEMA ===
El banco tiene ${fmt(totalClientes)} clientes registrados en total.
Hay ${fmt(cuentasActivas)} cuentas activas con un saldo total de ${fmtM(Number(saldoAgg._sum.saldo??0))}.
Hay ${fmt(prestamosVig)} préstamos vigentes por ${fmtM(Number(montoPrestAgg._sum.saldoPrestamo??0))}.
Se han detectado ${fmt(fraudeTotal)} transacciones con fraude potencial.
Hay ${fmt(cobrosExcTotal)} cobros que exceden el límite legal.
Hay ${fmt(tarjetasActivas)} tarjetas activas, ${fmt(segurosActivos)} seguros activos y ${fmt(metasActivas)} metas de ahorro activas.

=== CUENTAS NUEVAS POR AÑO (datos disponibles: 2021-2023) ===
En 2021 se abrieron ${fmt(a(cA,2021).nuevas??0)} cuentas nuevas.
En 2022 se abrieron ${fmt(a(cA,2022).nuevas??0)} cuentas nuevas (${dif(a(cA,2022).nuevas??0, a(cA,2021).nuevas??0)} vs 2021).
En 2023 se abrieron ${fmt(a(cA,2023).nuevas??0)} cuentas nuevas (${dif(a(cA,2023).nuevas??0, a(cA,2022).nuevas??0)} vs 2022).
El año con más cuentas nuevas fue ${anioMaxCuentas} con ${fmt(a(cA,anioMaxCuentas).nuevas??0)} cuentas.

=== TRANSACCIONES POR AÑO (datos disponibles: 2022-2024) ===
En 2022 hubo ${fmt(a(tA,2022).tx??0)} transacciones por ${fmtM(a(tA,2022).monto??0)}.
En 2023 hubo ${fmt(a(tA,2023).tx??0)} transacciones por ${fmtM(a(tA,2023).monto??0)} (${dif(a(tA,2023).tx??0, a(tA,2022).tx??0)} vs 2022).
En 2024 hubo ${fmt(a(tA,2024).tx??0)} transacciones por ${fmtM(a(tA,2024).monto??0)} (${dif(a(tA,2024).tx??0, a(tA,2023).tx??0)} vs 2023).
El año con más transacciones fue ${anioMaxTx} con ${fmt(a(tA,anioMaxTx).tx??0)} operaciones.

=== FRAUDE POR AÑO (datos disponibles: 2022-2024) ===
En 2022 se detectaron ${fmt(a(tA,2022).fraudes??0)} fraudes (tasa: ${pct(a(tA,2022).tasa??0)}).
En 2023 se detectaron ${fmt(a(tA,2023).fraudes??0)} fraudes (tasa: ${pct(a(tA,2023).tasa??0)}) — ${dif(a(tA,2023).fraudes??0, a(tA,2022).fraudes??0)} vs 2022.
En 2024 se detectaron ${fmt(a(tA,2024).fraudes??0)} fraudes (tasa: ${pct(a(tA,2024).tasa??0)}) — ${dif(a(tA,2024).fraudes??0, a(tA,2023).fraudes??0)} vs 2023.
El año con más fraudes fue ${anioMaxFraudes} con ${fmt(a(tA,anioMaxFraudes).fraudes??0)} casos.

=== PRÉSTAMOS POR AÑO (datos disponibles: 2021-2023) ===
En 2021 se otorgaron ${fmt(a(prA,2021).total??0)} préstamos por ${fmtM(a(prA,2021).monto??0)}.
En 2022 se otorgaron ${fmt(a(prA,2022).total??0)} préstamos por ${fmtM(a(prA,2022).monto??0)} (${dif(a(prA,2022).total??0, a(prA,2021).total??0)} vs 2021).
En 2023 se otorgaron ${fmt(a(prA,2023).total??0)} préstamos por ${fmtM(a(prA,2023).monto??0)} (${dif(a(prA,2023).total??0, a(prA,2022).total??0)} vs 2022).
El año con más préstamos fue ${anioMaxPrestamos} con ${fmt(a(prA,anioMaxPrestamos).total??0)} préstamos.

=== PAGOS POR AÑO (datos disponibles: 2022-2024) ===
En 2022 se procesaron ${fmt(a(pA,2022).total??0)} pagos por ${fmtM(a(pA,2022).monto??0)}.
En 2023 se procesaron ${fmt(a(pA,2023).total??0)} pagos por ${fmtM(a(pA,2023).monto??0)} (${dif(a(pA,2023).total??0, a(pA,2022).total??0)} vs 2022).
En 2024 se procesaron ${fmt(a(pA,2024).total??0)} pagos por ${fmtM(a(pA,2024).monto??0)} (${dif(a(pA,2024).total??0, a(pA,2023).total??0)} vs 2023).
El año con más pagos fue ${anioMaxPagos} con ${fmt(a(pA,anioMaxPagos).total??0)} pagos.

=== SEGUROS CONTRATADOS POR AÑO (datos disponibles: 2021-2023) ===
En 2021 se contrataron ${fmt(a(sA,2021).total??0)} seguros.
En 2022 se contrataron ${fmt(a(sA,2022).total??0)} seguros (${dif(a(sA,2022).total??0, a(sA,2021).total??0)} vs 2021).
En 2023 se contrataron ${fmt(a(sA,2023).total??0)} seguros (${dif(a(sA,2023).total??0, a(sA,2022).total??0)} vs 2022).

=== METAS DE AHORRO POR AÑO (datos disponibles: 2022-2024) ===
En 2022 se crearon ${fmt(a(mA,2022).total??0)} metas: ${fmt(a(mA,2022).completadas??0)} completadas, ${fmt(a(mA,2022).fallidas??0)} fallidas.
En 2023 se crearon ${fmt(a(mA,2023).total??0)} metas: ${fmt(a(mA,2023).completadas??0)} completadas, ${fmt(a(mA,2023).fallidas??0)} fallidas.
En 2024 se crearon ${fmt(a(mA,2024).total??0)} metas: ${fmt(a(mA,2024).completadas??0)} completadas, ${fmt(a(mA,2024).fallidas??0)} fallidas.
El año con más metas completadas fue ${anioMaxMetas} con ${fmt(a(mA,anioMaxMetas).completadas??0)} metas.

=== COBROS EXCEDIDOS POR AÑO (datos disponibles: 2022-2024) ===
En 2022 hubo ${fmt(a(cob,2022).excedidos??0)} cobros que excedieron el límite de ${fmt(a(cob,2022).total??0)} totales.
En 2023 hubo ${fmt(a(cob,2023).excedidos??0)} cobros excedidos de ${fmt(a(cob,2023).total??0)} totales (${dif(a(cob,2023).excedidos??0, a(cob,2022).excedidos??0)} vs 2022).
En 2024 hubo ${fmt(a(cob,2024).excedidos??0)} cobros excedidos de ${fmt(a(cob,2024).total??0)} totales (${dif(a(cob,2024).excedidos??0, a(cob,2023).excedidos??0)} vs 2023).

=== COMPARATIVA TRIMESTRAL DE TRANSACCIONES (2024 vs 2023) ===
${[1,2,3,4].map(q =>
  `${QNAMES[q-1]}: txs 2024=${fmt(tq(tT,2024,q).tx??0)} vs 2023=${fmt(tq(tT,2023,q).tx??0)} (${dif(tq(tT,2024,q).tx??0,tq(tT,2023,q).tx??0)}), fraudes 2024=${fmt(tq(tT,2024,q).fraudes??0)} vs 2023=${fmt(tq(tT,2023,q).fraudes??0)}.`
).join('\n')}

=== COMPARATIVA TRIMESTRAL DE CUENTAS NUEVAS (2023 vs 2022) ===
${[1,2,3,4].map(q =>
  `${QNAMES[q-1]}: cuentas nuevas 2023=${fmt(tq(cT,2023,q).nuevas??0)} vs 2022=${fmt(tq(cT,2022,q).nuevas??0)} (${dif(tq(cT,2023,q).nuevas??0,tq(cT,2022,q).nuevas??0)}).`
).join('\n')}

=== COMPARATIVA MENSUAL DE TRANSACCIONES (2024 vs 2023) ===
${MESES.map((mn,i) => {
  const mes = i+1;
  const t24 = tm(tM,2024,mes); const t23 = tm(tM,2023,mes);
  return `${mn}: 2024=${fmt(t24.tx??0)} txs vs 2023=${fmt(t23.tx??0)} (${dif(t24.tx??0,t23.tx??0)}), fraudes 2024=${fmt(t24.fraudes??0)} vs 2023=${fmt(t23.fraudes??0)}.`;
}).join('\n')}

=== ETL — ANÁLISIS DE FRAUDE ===
El pipeline ETL analizó ${fmt(etl.total_transacciones??0)} transacciones y detectó ${fmt(etl.total_fraudes??0)} fraudes.
La tasa de fraude ETL es ${pct(etl.tasa_fraude_pct??0)} con monto total en riesgo de ${fmtM(etl.monto_total_fraude??0)}.
Monto promedio por fraude: ${fmtM(etl.monto_promedio_fraude??0)}. Monto máximo: ${fmtM(etl.monto_maximo_fraude??0)}.
Por canal: ${fC.map((c:any)=>`${c.canal} tuvo ${fmt(c.total_fraudes??0)} fraudes (${pct(c.porcentaje??0)})`).join(', ')}.

=== TARJETAS DE CRÉDITO ===
La utilización global del crédito es del ${pct(u.util??0)} sobre ${fmt(u.tarjetas??0)} tarjetas activas.
El saldo total usado es ${fmtM(u.saldo??0)} de un límite de ${fmtM(u.limite??0)}.
Hay ${fmt(mo.morosas??0)} tarjetas bloqueadas por impago de ${fmt(mo.activas??0)} activas (morosidad: ${pct(mo.tasa??0)}).

=== PRÉSTAMOS VIGENTES POR TIPO ===
${(S(prestTipo) as any[]).map(p=>`${p.tipo}: ${fmt(p.total??0)} préstamos, saldo ${fmtM(p.saldo??0)}, tasa promedio ${pct(p.tasa??0)}, vencidos ${fmt(p.vencidos??0)}.`).join('\n')}

=== PAGOS ===
Por estatus: ${(S(pagosEst) as any[]).map(p=>`${p.est} es el ${pct(p.pct??0)} con ${fmt(p.total??0)} pagos`).join(', ')}.
Por canal: ${(S(pagosCan) as any[]).map(p=>`${p.canal} tiene el ${pct(p.pct??0)} con ${fmt(p.total??0)} pagos`).join(', ')}.

=== SEGUROS ACTUALES ===
${(S(segurosEst) as any[]).map(s=>`Pólizas ${s.est}: ${fmt(s.total??0)} (${pct(s.pct??0)})`).join('. ')}.
Prima anual promedio: ${fmtM(pa.promedio??0)}. Ingreso total por primas: ${fmtM(pa.total??0)} de ${fmt(pa.polizas??0)} pólizas activas.

=== NOTIFICACIONES ===
Por canal: ${(S(notiCan) as any[]).map(n=>`${n.canal}: ${fmt(n.total??0)} notificaciones (${pct(n.pct??0)})`).join(', ')}.

=== METAS DE AHORRO ACTUALES ===
${(S(metasEst) as any[]).map(m=>`${m.estatus}: ${fmt(m.total??0)} metas (${pct(m.pct??0)})`).join('. ')}.
Progreso promedio de metas activas: ${pct(mp.progreso??0)}.
Monto ahorrado hasta ahora: ${fmtM(mp.actual??0)} de un objetivo de ${fmtM(mp.objetivo??0)}.

=== CLIENTES ===
Por segmento: ${(S(segmentos) as any[]).map(s=>`${s.seg}: ${fmt(s.total??0)} clientes`).join(', ')}.
Por score crediticio: ${(S(scores) as any[]).map(s=>`${s.rango}: ${fmt(s.total??0)} clientes`).join(', ')}.

=== CAPTACIÓN COMERCIAL ===
De ${fmt(no.total??0)} empresas, ${fmt(no.con_nomina??0)} pagan nómina con BBVA (${pct(no.pct??0)} penetración).
Top 5 sucursales con más cuentas: ${(S(sucursales) as any[]).map((s,i)=>`${i+1}. ${s.sucursal}: ${fmt(s.cuentas??0)} cuentas`).join(', ')}.

=== INDICADORES DE RIESGO ===
Fraude potencial: ${pct(Number(pctFraude[0]?.pct??0))} (umbral 5%) — ${Number(pctFraude[0]?.pct??0)>5?'EN RIESGO':'DENTRO DEL LÍMITE'}.
Cobros excedidos: ${pct(Number(pctCobros[0]?.pct??0))} (umbral 10%) — ${Number(pctCobros[0]?.pct??0)>10?'EN RIESGO':'DENTRO DEL LÍMITE'}.
Cuentas canceladas: ${pct(Number(pctCanceladas[0]?.pct??0))} (umbral 20%) — ${Number(pctCanceladas[0]?.pct??0)>20?'EN RIESGO':'DENTRO DEL LÍMITE'}.
Préstamos vencidos: ${pct(Number(pctVencidos[0]?.pct??0))} (umbral 15%) — ${Number(pctVencidos[0]?.pct??0)>15?'EN RIESGO':'DENTRO DEL LÍMITE'}.
Metas de ahorro fallidas: ${pct(Number(pctMetasFallidas[0]?.pct??0))} (umbral 30%) — ${Number(pctMetasFallidas[0]?.pct??0)>30?'EN RIESGO':'DENTRO DEL LÍMITE'}.
`.trim();

  console.log(`✅ Contexto construido en ${((Date.now()-t0)/1000).toFixed(1)}s (${ctx.length} chars)`);
  const lineaCtx = ctx.split('\n').filter((l:string) => l.includes('cuentas nuevas')); console.log('CUENTAS:', lineaCtx.join(' | ')); contextCache = { data: ctx, timestamp: Date.now() };
  return ctx;
}

// ── Servicio exportado ────────────────────────────────────────────────────────
export const aiService = {
  chat: async (mensaje: string, historial: MensajeHistorial[]) => {
    let sistema: string;
    try {
      sistema = await recopilarContexto();
    } catch (err) {
      console.error('❌ Error recopilando contexto IA:', err);
      throw Object.assign(
        new Error(`Error contexto: ${(err as Error).message}`),
        { statusCode: 500 }
      );
    }

    console.log(`💬 Enviando a Ollama: "${mensaje.substring(0,60)}..."`);
    const t0 = Date.now();

    try {
      const response = await ollama.chat({
        model: MODELO,
        messages: [
          { role: 'system' as const, content: sistema },
          ...historial.slice(-2).map(h => ({
            role:    h.role as 'user' | 'assistant',
            content: h.content,
          })),
          { role: 'user' as const, content: mensaje },
        ],
        options: {
          temperature: 0.1,
          num_predict: 512,
          num_ctx:     6144,
        },
      });
      console.log(`✅ Ollama respondió en ${((Date.now()-t0)/1000).toFixed(1)}s`);
      return { respuesta: response.message.content, modelo: MODELO };
    } catch (err) {
      console.error(`❌ Error de Ollama (${((Date.now()-t0)/1000).toFixed(1)}s):`, err);
      throw Object.assign(
        new Error(`Error de IA: ${(err as Error).message}`),
        { statusCode: 503 }
      );
    }
  },

  invalidarCache: () => {
    contextCache = null;
    console.log('🗑️ Cache IA invalidado');
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      const list = await ollama.list();
      return list.models.length > 0;
    } catch { return false; }
  },

  listarModelos: async () => {
    const list = await ollama.list();
    return list.models.map(m => m.name);
  },
};