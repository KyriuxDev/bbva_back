// Generación de reportes PDF con pdfkit.
// Instalar: npm install pdfkit @types/pdfkit

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { kpisService } from '../kpis/kpis.service';

// ── Colores BBVA ───────────────────────────────────────────────────────────────
const AZUL    = '#004481';
const CELESTE = '#1973B8';
const GRIS    = '#666666';
const LINEA   = '#E0E0E0';
const ROJO    = '#D32F2F';
const VERDE   = '#388E3C';
const NARANJA = '#F57C00';

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface OpcionesReporte {
  kpis:            boolean;
  fraude:          boolean;
  debilidades:     boolean;
  recomendaciones: boolean;
  graficas:        boolean;
}

// ── Helpers de layout ──────────────────────────────────────────────────────────

/** Agrega nueva página si no hay suficiente espacio vertical. */
function checkPageBreak(doc: PDFKit.PDFDocument, altura = 100) {
  if (doc.y + altura > doc.page.height - 50) {
    doc.addPage();
    doc.y = 40;
  }
}

/** Encabezado con barra BBVA y título. Deja doc.y listo para contenido. */
function encabezado(doc: PDFKit.PDFDocument, titulo: string) {
  doc.rect(0, 0, doc.page.width, 58).fill(AZUL);
  doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
    .text('BBVA · Dashboard Administrativo', 30, 16);

  if (titulo) {
    doc.fillColor(AZUL).fontSize(15).font('Helvetica-Bold')
      .text(titulo, 30, 74);
    doc.fillColor(GRIS).fontSize(9).font('Helvetica')
      .text(`Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`, 30, 95);
    doc.moveTo(30, 112).lineTo(doc.page.width - 30, 112)
      .strokeColor(LINEA).lineWidth(0.5).stroke();
    doc.y = 122;
  } else {
    doc.y = 68;
  }
}

/** Tarjeta KPI pequeña con fondo gris claro. No actualiza doc.y (coordenadas absolutas). */
function tarjeta(
  doc: PDFKit.PDFDocument,
  label: string,
  valor: string,
  x: number,
  y: number,
  w = 160,
) {
  doc.rect(x, y, w, 55).fill('#F5F7FA');
  doc.fillColor(GRIS).fontSize(9).font('Helvetica')
    .text(label, x + 8, y + 8, { width: w - 16 });
  doc.fillColor(AZUL).fontSize(16).font('Helvetica-Bold')
    .text(valor, x + 8, y + 26, { width: w - 16 });
}

/** Título de sección con línea inferior color celeste. */
function seccion(doc: PDFKit.PDFDocument, texto: string) {
  checkPageBreak(doc, 30);
  doc.moveDown(0.6);
  doc.fillColor(CELESTE).fontSize(12).font('Helvetica-Bold').text(texto);
  const lineY = doc.y + 1;
  doc.moveTo(30, lineY).lineTo(doc.page.width - 30, lineY)
    .strokeColor(CELESTE).lineWidth(1).stroke();
  doc.lineWidth(0.5); // reset
  doc.y = lineY + 5;
}

/** Fila de tabla con columnas de ancho variable. */
function filaTabla(
  doc: PDFKit.PDFDocument,
  cols: string[],
  widths: number[],
  y: number,
  header = false,
) {
  let x = 30;
  cols.forEach((col, i) => {
    doc.fillColor(header ? 'white' : '#333333')
      .fontSize(9)
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .text(col, x + 4, y + 4, { width: widths[i] - 8 });
    x += widths[i];
  });
}

// ── Gráficas ───────────────────────────────────────────────────────────────────

/**
 * Gráfica de barras horizontales.
 * Dibuja label | barra | valor, de arriba hacia abajo.
 */
function graficaBarrasH(
  doc: PDFKit.PDFDocument,
  datos: { label: string; value: number }[],
  opts: {
    titulo: string;
    colorBarra?: string;
    formatValue?: (n: number) => string;
    maxItems?: number;
  },
) {
  const {
    titulo,
    colorBarra = AZUL,
    formatValue = (n: number) => n.toLocaleString('es-MX'),
    maxItems = 10,
  } = opts;

  const items = datos.slice(0, maxItems);
  if (items.length === 0) return;

  const itemH   = 20;
  const totalH  = items.length * itemH + 35;
  checkPageBreak(doc, totalH);

  seccion(doc, titulo);
  const startY  = doc.y;
  const labelW  = 155;
  const barAreaW = 265;
  const maxVal  = Math.max(...items.map(d => d.value), 1);

  items.forEach((d, i) => {
    const y    = startY + i * itemH;
    const barW = (d.value / maxVal) * barAreaW;
    const bgColor = i % 2 === 0 ? '#F5F7FA' : 'white';

    // Fondo de fila
    doc.rect(30, y, 460, itemH - 2).fill(bgColor);

    // Label
    doc.fillColor('#333333').fontSize(8).font('Helvetica')
      .text(d.label, 34, y + 5, { width: labelW - 6, ellipsis: true });

    // Barra fondo + barra valor
    doc.rect(30 + labelW, y + 4, barAreaW, itemH - 8).fill('#E8EDF2');
    if (barW > 0) {
      doc.rect(30 + labelW, y + 4, barW, itemH - 8).fill(colorBarra);
    }

    // Valor numérico
    doc.fillColor('#333333').fontSize(8).font('Helvetica-Bold')
      .text(formatValue(d.value), 30 + labelW + barAreaW + 6, y + 5, { width: 70 });
  });

  doc.y = startY + items.length * itemH + 8;
}

/**
 * Gráfica de barras verticales con ejes y etiquetas.
 * Ideal para tendencias temporales.
 */
function graficaBarrasV(
  doc: PDFKit.PDFDocument,
  datos: { label: string; value: number }[],
  opts: {
    titulo: string;
    colorBarra?: string;
    formatValue?: (n: number) => string;
  },
) {
  const {
    titulo,
    colorBarra = AZUL,
    formatValue = (n: number) => n.toLocaleString('es-MX'),
  } = opts;

  if (datos.length === 0) return;

  const chartH = 140;
  checkPageBreak(doc, chartH + 65);

  seccion(doc, titulo);

  const margenIzq = 45;
  const startX    = 30 + margenIzq;
  const startY    = doc.y + chartH;
  const maxVal    = Math.max(...datos.map(d => d.value), 1);
  const areaW     = doc.page.width - 80 - margenIzq;
  const gap       = 4;
  const barW      = Math.max(Math.floor(areaW / datos.length) - gap, 8);

  // Líneas de referencia horizontales (25 %, 50 %, 75 %, 100 %)
  [0.25, 0.5, 0.75, 1.0].forEach(pct => {
    const refY = startY - chartH * pct;
    doc.moveTo(startX - 5, refY).lineTo(startX + areaW, refY)
      .strokeColor('#DDDDDD').lineWidth(0.4).stroke();
    doc.lineWidth(0.5);
    doc.fillColor(GRIS).fontSize(6).font('Helvetica')
      .text(formatValue(Math.round(maxVal * pct)), 30, refY - 4, {
        width: margenIzq - 3,
        align: 'right',
      });
  });

  // Ejes
  doc.moveTo(startX - 5, startY - chartH)
    .lineTo(startX - 5, startY)
    .strokeColor('#AAAAAA').lineWidth(0.8).stroke();
  doc.moveTo(startX - 5, startY)
    .lineTo(startX + areaW, startY)
    .strokeColor('#AAAAAA').lineWidth(0.8).stroke();
  doc.lineWidth(0.5);

  // Barras y etiquetas
  datos.forEach((d, i) => {
    const barH  = (d.value / maxVal) * chartH;
    const x     = startX + i * (barW + gap);
    const y     = startY - barH;
    const color = i % 2 === 0 ? colorBarra : CELESTE;

    doc.rect(x, y, barW, barH).fill(color);

    // Valor dentro de la barra (si hay espacio)
    if (barH > 14) {
      doc.fillColor('white').fontSize(5.5).font('Helvetica-Bold')
        .text(formatValue(d.value), x - 1, y + 2, { width: barW + 2, align: 'center' });
    }

    // Etiqueta bajo el eje X
    doc.fillColor('#333333').fontSize(5.5).font('Helvetica')
      .text(d.label, x - 2, startY + 4, { width: barW + 4, align: 'center' });
  });

  doc.y = startY + 20;
}

// ── Servicio exportado ─────────────────────────────────────────────────────────

export const reportesService = {
  generarReporteKPIs: async (res: Response, opciones: OpcionesReporte) => {
    const fmt   = (n: number) => n.toLocaleString('es-MX');
    const money = (n: number) =>
      '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });

    // Cargar datos en paralelo; las gráficas solo si la sección está activa
    const [
      resumen,
      segmentos,
      tendencia,
      debilidades,
      canales,
      prestamosTipo,
      scoresDist,
      cobrosXTipo,
    ] = await Promise.all([
      kpisService.getResumen(),
      kpisService.getClientesPorSegmento(),
      kpisService.getTendencia12Meses(),
      kpisService.getDebilidades(),
      opciones.graficas ? kpisService.getTransaccionesPorCanal() : Promise.resolve([]),
      opciones.graficas ? kpisService.getPrestamosPorTipo()      : Promise.resolve([]),
      opciones.graficas ? kpisService.getDistribucionScore()     : Promise.resolve([]),
      opciones.graficas ? kpisService.getCobrosExcedidos()       : Promise.resolve([]),
    ]);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-kpis-${Date.now()}.pdf"`,
    );
    doc.pipe(res);

    // Castings de tipos para los arrays provenientes del repositorio
    type Segmento   = { segmento: string;  total: number };
    type Tendencia  = { mes: string;       total: number; monto_total: number };
    type Canal      = { canal: string;     total: number; monto_total: number };
    type Prestamo   = { tipo: string;      total: number; saldo_total: number };
    type Score      = { rango: string;     total: number };
    type Cobro      = { tipo: string;      total: number; diferencia_total: number };

    const segs  = segmentos   as unknown as Segmento[];
    const tend  = tendencia   as unknown as Tendencia[];
    const cans  = canales     as unknown as Canal[];
    const prests = prestamosTipo as unknown as Prestamo[];
    const scores = scoresDist  as unknown as Score[];
    const cobros = cobrosXTipo as unknown as Cobro[];

    // ────────────────────────────────────────────────────────────────────────
    //  PÁGINA 1 · KPIs + tablas
    // ────────────────────────────────────────────────────────────────────────
    encabezado(doc, 'Reporte de KPIs y Análisis');

    if (opciones.kpis) {
      // Tarjetas de resumen
      seccion(doc, 'Resumen General');
      const row1Y = doc.y + 4;

      tarjeta(doc, 'Total Clientes',      fmt(resumen.totalClientes),               30,  row1Y);
      tarjeta(doc, 'Cuentas Activas',     fmt(resumen.cuentasActivas),              200, row1Y);
      tarjeta(doc, 'Saldo Total',         money(Number(resumen.saldoTotalCuentas)), 370, row1Y);

      const row2Y = row1Y + 65;
      tarjeta(doc, 'Préstamos Vigentes',  fmt(resumen.prestamosActivos),            30,  row2Y);
      tarjeta(doc, 'Fraudes Potenciales', fmt(resumen.fraudesPotenciales),          200, row2Y);
      tarjeta(doc, 'Cobros Excedidos',    fmt(resumen.cobrosExcedidos),             370, row2Y);

      doc.y = row2Y + 65;

      // Tabla clientes por segmento
      const W = [200, 120, 100];
      seccion(doc, 'Clientes por Segmento');
      const hY1 = doc.y;
      doc.rect(30, hY1, W[0] + W[1] + W[2], 18).fill(AZUL);
      filaTabla(doc, ['Segmento', 'Total Clientes', ''], W, hY1, true);
      doc.y = hY1 + 18;

      segs.forEach((s, i) => {
        checkPageBreak(doc, 20);
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(30, rowY, W[0] + W[1] + W[2], 18).fill('#F5F7FA');
        filaTabla(doc, [s.segmento, fmt(s.total), ''], W, rowY);
        doc.y = rowY + 18;
      });
      doc.moveDown(0.8);

      // Tabla tendencia 12 meses
      const TW = [130, 110, 140];
      seccion(doc, 'Tendencia de Transacciones (últimos 12 meses)');
      const hY2 = doc.y;
      doc.rect(30, hY2, TW[0] + TW[1] + TW[2], 18).fill(AZUL);
      filaTabla(doc, ['Mes', 'Transacciones', 'Monto Total'], TW, hY2, true);
      doc.y = hY2 + 18;

      tend.forEach((t, i) => {
        checkPageBreak(doc, 20);
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(30, rowY, TW[0] + TW[1] + TW[2], 18).fill('#F5F7FA');
        filaTabla(doc, [t.mes, fmt(t.total), money(Number(t.monto_total))], TW, rowY);
        doc.y = rowY + 18;
      });
      doc.moveDown(0.8);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  SECCIÓN FRAUDE
    // ────────────────────────────────────────────────────────────────────────
    if (opciones.fraude) {
      checkPageBreak(doc, 120);
      seccion(doc, 'Análisis de Fraude Potencial');

      const pct   = debilidades.debilidades.porcentajeFraudePotencial;
      const cFraud = pct > 5 ? ROJO : pct > 2 ? NARANJA : VERDE;
      const nivel = pct > 5 ? 'ALTO' : pct > 2 ? 'MEDIO' : 'BAJO';
      const msg   =
        pct > 5
          ? 'Se recomienda activar protocolos de emergencia antifraude y revisar las reglas del motor de detección de manera inmediata.'
          : pct > 2
          ? 'Monitorear de cerca las transacciones sospechosas y reforzar los controles de autenticación.'
          : 'Los niveles de fraude están dentro de parámetros normales. Mantener monitoreo rutinario.';

      const cardY = doc.y;
      const cardH = 78;
      // Fondo de tarjeta
      doc.rect(30, cardY, doc.page.width - 60, cardH).fill('#FFF5F5');
      // Borde izquierdo de color
      doc.rect(30, cardY, 5, cardH).fill(cFraud);

      // Porcentaje grande
      doc.fillColor(cFraud).fontSize(30).font('Helvetica-Bold')
        .text(`${pct}%`, 45, cardY + 12, { width: 90, align: 'center' });

      // Textos a la derecha
      doc.fillColor('#333333').fontSize(11).font('Helvetica-Bold')
        .text('Transacciones con riesgo de fraude potencial', 145, cardY + 10, {
          width: doc.page.width - 185,
        });
      doc.fillColor(GRIS).fontSize(9).font('Helvetica')
        .text(
          `Total detectadas: ${fmt(resumen.fraudesPotenciales)} transacciones`,
          145, cardY + 28, { width: doc.page.width - 185 },
        );
      doc.fillColor(cFraud).fontSize(10).font('Helvetica-Bold')
        .text(`Nivel de riesgo: ${nivel}`, 145, cardY + 44, {
          width: doc.page.width - 185,
        });

      doc.y = cardY + cardH + 8;

      doc.fillColor('#333333').fontSize(9).font('Helvetica')
        .text(msg, 30, doc.y, { width: doc.page.width - 60 });
      doc.moveDown(0.8);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  PÁGINA DE GRÁFICAS
    // ────────────────────────────────────────────────────────────────────────
    if (opciones.graficas) {
      doc.addPage();
      encabezado(doc, 'Gráficas y Visualizaciones');

      // 1. Tendencia mensual (barras verticales)
      graficaBarrasV(doc,
        tend.map(t => ({ label: t.mes.substring(5), value: t.total })),
        {
          titulo: 'Transacciones por Mes (últimos 12 meses)',
          colorBarra: AZUL,
          formatValue: fmt,
        },
      );

      doc.moveDown(0.8);

      // 2. Clientes por segmento (barras horizontales)
      graficaBarrasH(doc,
        segs.map(s => ({ label: s.segmento, value: s.total })),
        {
          titulo: 'Clientes por Segmento',
          colorBarra: CELESTE,
          formatValue: fmt,
        },
      );

      doc.moveDown(0.8);

      // 3. Transacciones por canal
      graficaBarrasH(doc,
        cans.map(c => ({ label: c.canal, value: c.total })),
        {
          titulo: 'Transacciones por Canal',
          colorBarra: '#1973B8',
          formatValue: fmt,
        },
      );

      // ── Segunda página de gráficas ────────────────────────────────────────
      doc.addPage();
      encabezado(doc, 'Gráficas y Visualizaciones (cont.)');

      // 4. Distribución Score Crediticio
      graficaBarrasH(doc,
        scores.map(s => ({ label: s.rango, value: s.total })),
        {
          titulo: 'Distribución de Score Crediticio',
          colorBarra: VERDE,
          formatValue: fmt,
        },
      );

      doc.moveDown(0.8);

      // 5. Préstamos por tipo (saldo)
      graficaBarrasH(doc,
        prests.map(p => ({ label: p.tipo, value: p.total })),
        {
          titulo: 'Préstamos por Tipo',
          colorBarra: AZUL,
          formatValue: fmt,
        },
      );

      doc.moveDown(0.8);

      // 6. Cobros excedidos por tipo (solo si hay datos)
      if (cobros.length > 0) {
        graficaBarrasH(doc,
          cobros.map(c => ({ label: c.tipo, value: c.total })),
          {
            titulo: 'Cobros Excedidos por Tipo de Comisión',
            colorBarra: ROJO,
            formatValue: fmt,
          },
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    //  PÁGINA DEBILIDADES + RECOMENDACIONES
    // ────────────────────────────────────────────────────────────────────────
    if (opciones.debilidades || opciones.recomendaciones) {
      doc.addPage();
      encabezado(doc, 'Debilidades y Soluciones');
    }

    if (opciones.debilidades) {
      seccion(doc, 'Indicadores de Riesgo');

      const d = debilidades.debilidades;
      const indicadores: Array<{ label: string; valor: string; riesgo: boolean }> = [
        {
          label: 'Fraude potencial',
          valor: `${d.porcentajeFraudePotencial}%`,
          riesgo: d.porcentajeFraudePotencial > 5,
        },
        {
          label: 'Cobros excedidos',
          valor: `${d.porcentajeCobrosExcedidos}%`,
          riesgo: d.porcentajeCobrosExcedidos > 10,
        },
        {
          label: 'Cuentas canceladas',
          valor: `${d.porcentajeCuentasCanceladas}%`,
          riesgo: d.porcentajeCuentasCanceladas > 20,
        },
        {
          label: 'Préstamos vencidos',
          valor: `${d.porcentajePrestamosVencidos}%`,
          riesgo: d.porcentajePrestamosVencidos > 15,
        },
        {
          label: 'Metas de ahorro fallidas',
          valor: `${d.porcentajeMetasFallidas}%`,
          riesgo: d.porcentajeMetasFallidas > 30,
        },
      ];

      indicadores.forEach((ind, i) => {
        checkPageBreak(doc, 28);
        const rowY      = doc.y;
        const barColor  = ind.riesgo ? ROJO : VERDE;
        const bgColor   = i % 2 === 0 ? '#F9F9F9' : 'white';

        doc.rect(30, rowY, doc.page.width - 60, 24).fill(bgColor);
        doc.rect(30, rowY, 4, 24).fill(barColor);   // borde color

        doc.fillColor('#333333').fontSize(10).font('Helvetica')
          .text(`${ind.label}:`, 42, rowY + 6, { width: 220 });
        doc.fillColor(barColor).fontSize(10).font('Helvetica-Bold')
          .text(ind.valor, 270, rowY + 6, { width: 80 });
        doc.fillColor(GRIS).fontSize(8).font('Helvetica')
          .text(ind.riesgo ? '⚠ Por encima del umbral' : '✓ Dentro del umbral', 360, rowY + 7, {
            width: doc.page.width - 395,
          });

        doc.y = rowY + 26;
      });
      doc.moveDown(0.8);
    }

    if (opciones.recomendaciones) {
      seccion(doc, 'Soluciones Recomendadas');

      if (debilidades.soluciones.length === 0) {
        doc.fillColor(GRIS).fontSize(10).font('Helvetica')
          .text('No se detectaron áreas de mejora urgentes en este período.');
      } else {
        debilidades.soluciones.forEach(s => {
          checkPageBreak(doc, 65);

          const cardY       = doc.y;
          const cardH       = 60;
          const colorPrio   =
            s.prioridad === 'Alta'  ? ROJO :
            s.prioridad === 'Media' ? NARANJA : VERDE;

          // Fondo + borde lateral
          doc.rect(30, cardY, doc.page.width - 60, cardH).fill('#F9F9F9');
          doc.rect(30, cardY, 4, cardH).fill(colorPrio);

          // Encabezado de tarjeta
          doc.fillColor(AZUL).fontSize(11).font('Helvetica-Bold')
            .text(`[${s.prioridad}]  ${s.area}`, 42, cardY + 6, {
              width: doc.page.width - 80,
            });
          doc.fillColor(ROJO).fontSize(9).font('Helvetica')
            .text(`⚠ Problema: ${s.problema}`, 42, cardY + 22, {
              width: doc.page.width - 80,
            });
          doc.fillColor('#1B5E20').fontSize(9).font('Helvetica')
            .text(`✓ Solución: ${s.solucion}`, 42, cardY + 38, {
              width: doc.page.width - 80,
            });

          doc.y = cardY + cardH + 6;
        });
      }
    }

    doc.end();
  },
};
