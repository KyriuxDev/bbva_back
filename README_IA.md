# Integración de IA Local con Ollama — BBVA Dashboard

Guía completa de cómo se integró un asistente de inteligencia artificial
local y gratuito al dashboard móvil BBVA, usando Ollama como motor de IA.

---

## Stack de la integración

| Capa | Tecnología |
|------|-----------|
| Motor de IA | Ollama (local, sin costo) |
| Modelo | llama3.1:8b |
| Backend | Express 5 + TypeScript |
| Frontend | React Native + Expo |
| Comunicación | REST API (axios) |

---

## Arquitectura

```
Admin escribe pregunta en el app
        ↓
React Native → POST /api/v1/ai/chat
        ↓
Backend recopila KPIs en tiempo real desde PostgreSQL
        ↓
Backend → Ollama en localhost:11434
        ↓
llama3.1:8b genera análisis (sin internet, sin costo)
        ↓
Respuesta al admin en ~3-8 segundos
```

---

## Parte 1 — Configuración de Ollama

### 1.1 Instalar Ollama

```bash
# Linux / Mac
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Descargar instalador desde https://ollama.com/download
```

### 1.2 Descargar el modelo

```bash
ollama pull llama3.1:8b
```

### 1.3 Verificar instalación

```bash
ollama list
# Debe mostrar:
# NAME            SIZE
# llama3.1:8b     4.7 GB
```

### 1.4 Configurar para escuchar en todas las interfaces (necesario para Docker)

```bash
# Detener el servicio
sudo systemctl stop ollama

# Editar la configuración
sudo systemctl edit ollama
```

Agregar en el editor:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

```bash
# Aplicar cambios
sudo systemctl daemon-reload
sudo systemctl start ollama

# Verificar
curl http://localhost:11434/api/tags
```

---

## Parte 2 — Backend

### 2.1 Instalar dependencia

```bash
npm install ollama
```

### 2.2 Variables de entorno

Agregar al `.env`:

```ini
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### 2.3 Servicio de IA

Crear `src/ai/ai.service.ts`:

```typescript
import { Ollama } from 'ollama';
import { kpisService } from '../kpis/kpis.service';
import { etlService }  from '../etl/etl.service';

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

=== INDICADORES DE RIESGO ===
Fraude potencial:   ${debilidades.debilidades.porcentajeFraudePotencial}% (umbral 5%)
Cobros excedidos:   ${debilidades.debilidades.porcentajeCobrosExcedidos}% (umbral 10%)
Cuentas canceladas: ${debilidades.debilidades.porcentajeCuentasCanceladas}% (umbral 20%)
Préstamos vencidos: ${debilidades.debilidades.porcentajePrestamosVencidos}% (umbral 15%)
Metas fallidas:     ${debilidades.debilidades.porcentajeMetasFallidas}% (umbral 30%)

=== SEGMENTOS ===
${segmentos.map((s: any) => `${s.segmento}: ${s.total} clientes`).join('\n')}
    `.trim();

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
        temperature: 0.3,
        num_predict: 512,
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
```

### 2.4 Router

Crear `src/ai/ai.router.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { aiService } from './ai.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const aiRouter = Router();
aiRouter.use(authMiddleware);

// Chat principal
aiRouter.post('/chat', async (req: Request, res: Response) => {
  const { mensaje, historial } = req.body;

  if (!mensaje?.trim()) {
    res.status(400).json({ message: 'El mensaje es requerido' });
    return;
  }

  const disponible = await aiService.healthCheck();
  if (!disponible) {
    res.status(503).json({
      message: 'El servicio de IA no está disponible.',
    });
    return;
  }

  const respuesta = await aiService.chat(mensaje, historial ?? []);
  res.json(respuesta);
});

// Health check
aiRouter.get('/status', async (_req: Request, res: Response) => {
  const disponible = await aiService.healthCheck();
  const modelos    = disponible ? await aiService.listarModelos() : [];
  res.json({ disponible, modelos });
});
```

### 2.5 Registrar router en app.ts

```typescript
import { aiRouter } from './ai/ai.router';

app.use('/api/v1/ai', aiRouter);
```

### 2.6 Configuración Docker

En `docker-compose.yml`, agregar al servicio `api`:

```yaml
services:
  api:
    environment:
      OLLAMA_HOST: http://host.docker.internal:11434
      OLLAMA_MODEL: llama3.1:8b
    extra_hosts:
      - "host.docker.internal:host-gateway"  # necesario en Linux
```

---

## Parte 3 — Frontend

### 3.1 Componente ChatIA

Crear `src/features/dashboard/components/ChatIA.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/axios';

interface Mensaje {
  role:    'user' | 'assistant';
  content: string;
}

const SUGERENCIAS = [
  '¿Cuál es el estado general hoy?',
  '¿Qué indicador está más crítico?',
  'Resume el análisis de fraude',
  '¿Qué sucursal debo priorizar?',
];

export function ChatIA() {
  const [mensajes,     setMensajes]     = useState<Mensaje[]>([]);
  const [input,        setInput]        = useState('');
  const [cargando,     setCargando]     = useState(false);
  const [iaDisponible, setIaDisponible] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api.get('/ai/status')
      .then(({ data }) => setIaDisponible(data.disponible))
      .catch(() => setIaDisponible(false));
  }, []);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || cargando) return;

    setMensajes(prev => [...prev, { role: 'user', content: texto }]);
    setInput('');
    setCargando(true);

    try {
      const { data } = await api.post('/ai/chat', {
        mensaje:   texto,
        historial: mensajes.slice(-6),
      });
      setMensajes(prev => [
        ...prev,
        { role: 'assistant', content: data.respuesta },
      ]);
    } catch {
      setMensajes(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Error al conectar con la IA.' },
      ]);
    } finally {
      setCargando(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  // ... resto del componente (ver archivo completo en el repo)
}
```

### 3.2 Agregar tab IA en el dashboard

En `app/(main)/dashboard/index.tsx`:

**1. Actualizar el tipo del estado:**

```typescript
const [activeTab, setActiveTab] = useState
  'Inicio' | 'KPIs' | 'Debilidades' | 'Objetivos' | 'IA'
>('Inicio');
```

**2. Importar el componente:**

```typescript
import { ChatIA } from '@/src/features/dashboard/components/ChatIA';
```

**3. Agregar la sección dentro del `<View style={{ flex: 1 }}>`:**

```typescript
{activeTab === 'IA' && (
  <View style={{ flex: 1 }}>
    <ChatIA />
  </View>
)}
```

**4. Agregar el tab en la barra de navegación:**

```typescript
{ key: 'IA', icon: 'sparkles', iconO: 'sparkles-outline' },
```

---

## Parte 4 — Verificación

### 4.1 Levantar todo

```bash
# Terminal 1 — Ollama
ollama serve

# Terminal 2 — Backend con Docker
docker compose up --build

# Terminal 3 — Frontend
npx expo start --clear
```

### 4.2 Probar el backend

```bash
# Obtener token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bbva.com","password":"Admin123!"}'

# Verificar status de IA
curl http://localhost:3000/api/v1/ai/status \
  -H "Authorization: Bearer TU_TOKEN"

# Probar chat
curl -X POST http://localhost:3000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{"mensaje":"¿Cuál es el estado general del sistema?","historial":[]}'
```

### 4.3 Respuesta esperada

```json
{
  "respuesta": "El estado general del sistema es estable...",
  "modelo": "llama3.1:8b"
}
```

---

## Comparativa de opciones evaluadas

| | Ollama (elegida) | Claude API |
|---|---|---|
| **Costo** | Gratis ✅ | ~$5-20/mes |
| **Privacidad** | 100% local ✅ | Datos en la nube |
| **Velocidad** | 3-8s (CPU) | ~1-2s |
| **Calidad** | Muy buena | Excelente |
| **Internet** | No necesita ✅ | Necesita |
| **Setup** | 5 minutos | Inmediato |

Se eligió Ollama por ser gratuita, no requerir internet y mantener
los datos financieros 100% en local, lo cual es crítico para un
dashboard bancario.

---

## Modelos alternativos probados

| Modelo | RAM | Velocidad | Calidad |
|--------|-----|-----------|---------|
| `llama3.2:3b` | 4GB | Rápido | Buena |
| `llama3.1:8b` | 8GB | Media | Muy buena ✅ |
| `mistral:7b` | 8GB | Media | Muy buena |
| `llama3.1:70b` | 64GB | Lento | Excelente |

---

## Solución de problemas

| Error | Causa | Solución |
|-------|-------|----------|
| `"disponible": false` | Ollama no corre | Ejecutar `ollama serve` |
| `Connection refused` en Docker | Docker no alcanza el host | Agregar `extra_hosts` en docker-compose |
| Respuesta lenta | CPU sin GPU | Normal en CPU; usar GPU si disponible |
| Texto cortado | `num_predict` bajo | Aumentar a 1024 en `ai.service.ts` |

---

*DSD-2303 · Desarrollo de Servicios Web · Instituto Tecnológico de Oaxaca*