// Generación de reportes PDF con pdfkit.
// Instalar: npm install pdfkit @types/pdfkit

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { kpisService } from '../kpis/kpis.service';

// Colores BBVA
const AZUL   = '#004481';
const CELESTE = '#1973B8';
const GRIS   = '#666666';
const LINEA  = '#E0E0E0';

function encabezado(doc: PDFKit.PDFDocument, titulo: string) {
  // Barra superior
  doc.rect(0, 0, doc.page.width, 60).fill(AZUL);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
    .text('BBVA · Dashboard Administrativo', 30, 18);

  // Título del reporte
  doc.fillColor(AZUL).fontSize(16).font('Helvetica-Bold')
    .text(titulo, 30, 80);

  doc.fillColor(GRIS).fontSize(10).font('Helvetica')
    .text(`Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`, 30, 100);

  doc.moveTo(30, 120).lineTo(doc.page.width - 30, 120).strokeColor(LINEA).stroke();
  doc.moveDown(2);
}

function tarjeta(doc: PDFKit.PDFDocument, label: string, valor: string, x: number, y: number, w = 160) {
  doc.rect(x, y, w, 55).fill('#F5F7FA');
  doc.fillColor(GRIS).fontSize(9).font('Helvetica').text(label, x + 8, y + 8, { width: w - 16 });
  doc.fillColor(AZUL).fontSize(16).font('Helvetica-Bold').text(valor, x + 8, y + 24, { width: w - 16 });
}

function seccion(doc: PDFKit.PDFDocument, texto: string) {
  doc.moveDown(1);
  doc.fillColor(CELESTE).fontSize(12).font('Helvetica-Bold').text(texto);
  doc.moveTo(30, doc.y + 2).lineTo(doc.page.width - 30, doc.y + 2).strokeColor(CELESTE).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function fila(doc: PDFKit.PDFDocument, cols: string[], y: number, header = false) {
  const widths = [180, 100, 140];
  let x = 30;
  cols.forEach((col, i) => {
    doc.fillColor(header ? 'white' : '#333333')
      .fontSize(9)
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .text(col, x + 4, y + 4, { width: widths[i] - 8 });
    x += widths[i];
  });
}

export const reportesService = {
  generarReporteKPIs: async (res: Response) => {
    const [resumen, segmentos, tendencia, debilidades] = await Promise.all([
      kpisService.getResumen(),
      kpisService.getClientesPorSegmento(),
      kpisService.getTendencia12Meses(),
      kpisService.getDebilidades(),
    ]);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-kpis-${Date.now()}.pdf"`);
    doc.pipe(res);

    encabezado(doc, 'Reporte de KPIs');

    // ── Tarjetas de resumen ────────────────────────────────────────────────
    seccion(doc, 'Resumen General');
    const baseY = doc.y + 5;
    const fmt = (n: number) => n.toLocaleString('es-MX');
    const money = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });

    tarjeta(doc, 'Total Clientes',       fmt(resumen.totalClientes),              30,  baseY);
    tarjeta(doc, 'Cuentas Activas',      fmt(resumen.cuentasActivas),             200, baseY);
    tarjeta(doc, 'Saldo Total',          money(Number(resumen.saldoTotalCuentas)), 370, baseY);

    const baseY2 = baseY + 70;
    tarjeta(doc, 'Préstamos Vigentes',   fmt(resumen.prestamosActivos),            30,  baseY2);
    tarjeta(doc, 'Fraudes Potenciales',  fmt(resumen.fraudesPotenciales),          200, baseY2);
    tarjeta(doc, 'Cobros Excedidos',     fmt(resumen.cobrosExcedidos),             370, baseY2);

    doc.y = baseY2 + 70;

    // ── Clientes por segmento ──────────────────────────────────────────────
    seccion(doc, 'Clientes por Segmento');
    const headerY = doc.y;
    doc.rect(30, headerY, 420, 18).fill(AZUL);
    fila(doc, ['Segmento', 'Total Clientes', ''], headerY, true);
    doc.y = headerY + 18;

    (segmentos as unknown as { segmento: string; total: number }[]).forEach((s, i) => {
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(30, rowY, 420, 18).fill('#F5F7FA');
      fila(doc, [s.segmento, fmt(s.total), ''], rowY);
      doc.y = rowY + 18;
    });
    doc.moveDown(1);

    // ── Tendencia 12 meses ─────────────────────────────────────────────────
    seccion(doc, 'Tendencia de Transacciones (últimos 12 meses)');
    const tHeaderY = doc.y;
    doc.rect(30, tHeaderY, 420, 18).fill(AZUL);
    fila(doc, ['Mes', 'Transacciones', 'Monto Total'], tHeaderY, true);
    doc.y = tHeaderY + 18;

    (tendencia as unknown as { mes: string; total: number; monto_total: number }[]).forEach((t, i) => {
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(30, rowY, 420, 18).fill('#F5F7FA');
      fila(doc, [t.mes, fmt(t.total), money(Number(t.monto_total))], rowY);
      doc.y = rowY + 18;
    });
    doc.moveDown(1);

    // ── Debilidades y soluciones ───────────────────────────────────────────
    doc.addPage();
    encabezado(doc, 'Debilidades y Soluciones');

    seccion(doc, 'Indicadores de Riesgo');
    const d = debilidades.debilidades;
    const indicadores = [
      ['Fraude potencial',      `${d.porcentajeFraudePotencial}%`],
      ['Cobros excedidos',      `${d.porcentajeCobrosExcedidos}%`],
      ['Cuentas canceladas',    `${d.porcentajeCuentasCanceladas}%`],
      ['Préstamos vencidos',    `${d.porcentajePrestamosVencidos}%`],
      ['Metas de ahorro fallidas', `${d.porcentajeMetasFallidas}%`],
    ];

    indicadores.forEach(([label, valor]) => {
      doc.fillColor('#333333').fontSize(10).font('Helvetica')
        .text(`• ${label}: `, { continued: true })
        .font('Helvetica-Bold').fillColor(AZUL).text(valor);
    });

    doc.moveDown(1);
    seccion(doc, 'Soluciones Recomendadas');

    if (debilidades.soluciones.length === 0) {
      doc.fillColor(GRIS).fontSize(10).text('No se detectaron áreas de mejora urgentes.');
    } else {
      debilidades.soluciones.forEach((s) => {
        const colorPrioridad = s.prioridad === 'Alta' ? '#D32F2F' : s.prioridad === 'Media' ? '#F57C00' : '#388E3C';
        doc.rect(30, doc.y, 4, 50).fill(colorPrioridad);
        doc.fillColor(AZUL).fontSize(11).font('Helvetica-Bold')
          .text(`[${s.prioridad}] ${s.area}`, 42, doc.y);
        doc.fillColor('#D32F2F').fontSize(9).font('Helvetica')
          .text(`Problema: ${s.problema}`, 42);
        doc.fillColor('#333333')
          .text(`Solución: ${s.solucion}`, 42);
        doc.moveDown(0.8);
      });
    }

    doc.end();
  },
};
