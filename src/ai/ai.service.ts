// src/ai/ai.service.ts
import { Ollama } from 'ollama';
import { kpisService } from '../kpis/kpis.service';
import { etlService }  from '../etl/etl.service';

// Si el backend corre en Docker, usar host.docker.internal
// Si corre local directamente, usar localhost
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
});

const MODELO = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';

interface MensajeHistorial {
  role:    'user' | 'assistant';
  content: string;
}

export const aiService = {
  chat: async (mensaje: string, historial: MensajeHistorial[]) => {

    // 1. Recopilar contexto financiero actual
    const [resumen, debilidades, etl, segmentos] = await Promise.all([
      kpisService.getResumen(),
      kpisService.getDebilidades(),
      etlService.getResumen(),
      kpisService.getClientesPorSegmento(),
    ]);

    const sistema = `
Eres un analista financiero senior especializado en banca retail mexicana.
Tienes acceso a los datos en tiempo real del dashboard BBVA México.
Responde SIEMPRE en español. Sé conciso y accionable.
Si te preguntan algo fuera del contexto bancario, redirige amablemente.

=== DATOS ACTUALES DEL SISTEMA ===
Clientes totales:    ${resumen.totalClientes}
Cuentas activas:     ${resumen.cuentasActivas}
Saldo total:         $${Number(resumen.saldoTotalCuentas).toLocaleString('es-MX')} MXN
Transacciones hoy:   ${resumen.transaccionesHoy}
Fraudes potenciales: ${resumen.fraudesPotenciales}
Cobros excedidos:    ${resumen.cobrosExcedidos}

=== ETL — FRAUDE ===
Transacciones analizadas: ${etl.total_transacciones}
Fraudes detectados:       ${etl.total_fraudes}
Tasa de fraude:           ${etl.tasa_fraude_pct}%
Monto en riesgo:          $${Number(etl.monto_total_fraude).toLocaleString('es-MX')} MXN

=== INDICADORES DE RIESGO (umbral entre paréntesis) ===
Fraude potencial:   ${debilidades.debilidades.porcentajeFraudePotencial}% (umbral 5%)
Cobros excedidos:   ${debilidades.debilidades.porcentajeCobrosExcedidos}% (umbral 10%)
Cuentas canceladas: ${debilidades.debilidades.porcentajeCuentasCanceladas}% (umbral 20%)
Préstamos vencidos: ${debilidades.debilidades.porcentajePrestamosVencidos}% (umbral 15%)
Metas fallidas:     ${debilidades.debilidades.porcentajeMetasFallidas}% (umbral 30%)

=== SEGMENTOS ===
${segmentos.map((s: any) => `${s.segmento}: ${s.total} clientes`).join('\n')}
    `.trim();

    // 2. Construir mensajes con historial
    const messages = [
      { role: 'system' as const, content: sistema },
      ...historial.map(h => ({
        role:    h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: mensaje },
    ];

    // 3. Llamar a Ollama
    const response = await ollama.chat({
      model:    MODELO,
      messages,
      options: {
        temperature: 0.3,   // más determinista para análisis financiero
        num_predict: 512,   // máximo de tokens en la respuesta
      },
    });

    return {
      respuesta: response.message.content,
      modelo:    MODELO,
    };
  },

  // Verificar que Ollama esté corriendo
  healthCheck: async (): Promise<boolean> => {
    try {
      const list = await ollama.list();
      return list.models.length > 0;
    } catch {
      return false;
    }
  },

  // Listar modelos disponibles
  listarModelos: async () => {
    const list = await ollama.list();
    return list.models.map(m => m.name);
  },
};