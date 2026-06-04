# BBVA Dashboard — Backend API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?style=for-the-badge&logo=docker&logoColor=white"/>
</p>

API REST que alimenta el dashboard administrativo de análisis BBVA. Expone KPIs en tiempo real, gráficas, reportes PDF, análisis de debilidades financieras y un módulo de IA conversacional local. Construido con **Express 5**, **Prisma 7** y **PostgreSQL 16**.

---

## Índice

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura del proyecto](#arquitectura-del-proyecto)
3. [Base de datos](#base-de-datos)
4. [Módulos y endpoints](#módulos-y-endpoints)
5. [Proceso ETL](#proceso-etl)
6. [Módulo de IA (Ollama)](#módulo-de-ia-ollama)
7. [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
8. [Variables de entorno](#variables-de-entorno)
9. [Autenticación JWT](#autenticación-jwt)
10. [Generación de reportes PDF](#generación-de-reportes-pdf)
11. [Documentación Swagger](#documentación-swagger)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 22 |
| Lenguaje | TypeScript | 5.9 |
| Framework | Express | 5 |
| ORM | Prisma + adaptador pg | 7 |
| Base de datos | PostgreSQL | 16 |
| Autenticación | JWT + bcryptjs | — |
| Validación | Zod | 4 |
| Reportes | PDFKit | 0.15 |
| IA local | Ollama (llama3.1:8b) | — |
| Documentación | Swagger UI | — |
| Contenedores | Docker + Docker Compose | — |

---

## Arquitectura del proyecto

```
bbva-backend/
├── src/
│   ├── app.ts                        ← Express + middlewares + routers
│   ├── server.ts                     ← Punto de entrada HTTP
│   ├── config.ts                     ← Variables de entorno validadas con Zod
│   ├── prisma.ts                     ← Cliente Prisma singleton (adaptador pg)
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts        ← Guard JWT: verifica Bearer token
│   │   └── error.middleware.ts       ← Handler global de errores con statusCode
│   │
│   ├── auth/                         ← Módulo de autenticación
│   │   ├── auth.router.ts            ← POST /login  GET /me
│   │   ├── auth.service.ts           ← bcrypt + firma JWT
│   │   └── auth.schema.ts            ← Validación Zod del body de login
│   │
│   ├── kpis/                         ← Módulo de KPIs del dashboard
│   │   ├── kpis.router.ts            ← 25+ endpoints de métricas
│   │   ├── kpis.service.ts           ← Lógica de debilidades y serialización
│   │   └── kpis.repository.ts        ← Queries SQL agregadas con $queryRaw
│   │
│   ├── clientes/                     ← Módulo de clientes
│   │   ├── clientes.router.ts        ← Lista paginada + sub-rutas de perfil
│   │   ├── clientes.service.ts       ← Validación de existencia + delegación
│   │   └── clientes.repository.ts    ← Prisma ORM (findMany, findUnique)
│   │
│   ├── transacciones/                ← Módulo de transacciones
│   │   ├── transacciones.router.ts   ← Filtros: fecha, canal, categoría, fraude
│   │   ├── transacciones.service.ts
│   │   └── transacciones.repository.ts
│   │
│   ├── etl/                          ← Módulo ETL (datos del pipeline Python)
│   │   ├── etl.router.ts             ← Endpoints del schema dwh
│   │   ├── etl.service.ts
│   │   └── etl.repository.ts         ← $queryRaw sobre vistas dwh.*
│   │
│   ├── reportes/                     ← Módulo de reportes PDF
│   │   ├── reportes.router.ts        ← GET /kpis → descarga binaria
│   │   └── reportes.service.ts       ← Generación con PDFKit (barras, líneas)
│   │
│   └── ai/                           ← Módulo de IA conversacional
│       ├── ai.router.ts              ← POST /chat  GET /status
│       └── ai.service.ts             ← Contexto histórico + llamada a Ollama
│
├── prisma/
│   ├── schema.prisma                 ← 14 tablas + admins
│   ├── seed.ts                       ← Admin inicial (upsert)
│   └── seed-data.ts                  ← Datos de prueba con Faker
│
├── docker/
│   └── init/                         ← Coloca aquí los .sql recibidos del equipo
│
├── docker-compose.yml
├── Dockerfile
├── prisma.config.ts
├── .env.example
└── tsconfig.json
```

### Flujo de una petición

```
Cliente HTTP
    │
    ▼
authMiddleware (verifica JWT)
    │
    ▼
Router (Express 5)
    │
    ▼
Service (lógica de negocio + serialize BigInt/Decimal)
    │
    ▼
Repository ($queryRaw o Prisma ORM)
    │
    ▼
PostgreSQL 16
```

---

## Base de datos

El esquema principal vive en el schema `public` de la base `bbva_v2`. El pipeline ETL escribe en el schema `dwh`.

### Tablas principales

| Tabla | Registros aprox. | Descripción |
|-------|-----------------|-------------|
| `clientes` | 50,000 | Entidad central con RFC, CURP, estado civil |
| `transacciones` | 1,016,934 | Movimientos bancarios con coordenadas y flag de fraude |
| `pagos` | 321,576 | Pagos realizados por canal |
| `cobros` | 169,781 | Comisiones con campo `excede_limite` |
| `cuentas` | 127,203 | Cuentas activas/canceladas con saldo y sucursal |
| `prestamos` | 77,375 | Créditos con tasa, plazo y estatus |
| `notificaciones` | 35,297 | Alertas por canal (push, SMS, email) |
| `metas_ahorro` | 24,976 | Objetivos de ahorro con progreso |
| `seguros` | 22,618 | Pólizas con prima anual |
| `tarjetas` | 20,252 | Tarjetas crédito/débito con límite y estatus |
| `financiaciones` | 15,147 | Financiamientos con tasa e interés |
| `open_data` | 50,000 | Score crediticio y segmento por cliente |
| `datos_personales` | 50,000 | Contacto, dirección y coordenadas habituales |
| `auditoria_comisiones` | 50,000 | Registro de diferencias en comisiones |
| `admins` | — | Usuarios del dashboard (bcrypt) |

### Schema DWH (ETL)

Generado por el pipeline Python y consultado por los endpoints `/etl/*`:

| Vista / Tabla | Descripción |
|---------------|-------------|
| `dwh.resumen_general` | KPIs globales de fraude (tasa, montos MXN y USD) |
| `dwh.fraude_por_categoria` | Fraudes agrupados por categoría de comercio |
| `dwh.fraude_por_canal` | Fraudes por canal con porcentaje |
| `dwh.fraude_por_mes` | Tendencia mensual de 36 meses |
| `dwh.alertas_fraude` | Alertas enriquecidas con datos de cliente |

---

## Módulos y endpoints

Todos los endpoints (excepto `/auth/login`) requieren el header:

```
Authorization: Bearer <JWT>
```

### Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Recibe `{ email, password }` → retorna `{ token, admin }` |
| `GET` | `/api/v1/auth/me` | Retorna el payload del token activo |

### KPIs

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/kpis/resumen` | Tarjetas principales: clientes, saldo, fraudes, cobros |
| `GET` | `/api/v1/kpis/clientes-por-segmento` | Distribución por segmento |
| `GET` | `/api/v1/kpis/clientes-por-genero` | Distribución por género |
| `GET` | `/api/v1/kpis/transacciones-por-categoria` | Volumen y monto por categoría |
| `GET` | `/api/v1/kpis/transacciones-por-canal` | App, Web, Sucursal, Cajero |
| `GET` | `/api/v1/kpis/tendencia` | Últimos 12 meses de transacciones |
| `GET` | `/api/v1/kpis/prestamos-por-tipo` | Saldo por tipo de crédito |
| `GET` | `/api/v1/kpis/saldo-por-tipo-cuenta` | Saldo en cuentas activas |
| `GET` | `/api/v1/kpis/score-crediticio` | Distribución de scores en rangos |
| `GET` | `/api/v1/kpis/cobros-excedidos` | Comisiones fuera de límite legal |
| `GET` | `/api/v1/kpis/debilidades` | Análisis automático + soluciones priorizadas |
| `GET` | `/api/v1/kpis/pagos-por-estatus` | Tasa de éxito en pagos |
| `GET` | `/api/v1/kpis/pagos-por-canal` | Canal de pago más utilizado |
| `GET` | `/api/v1/kpis/seguros-por-estatus` | Pólizas activas vs canceladas |
| `GET` | `/api/v1/kpis/prima-anual` | Prima promedio y total del portafolio |
| `GET` | `/api/v1/kpis/notificaciones-por-estatus` | Tasa de entrega de notificaciones |
| `GET` | `/api/v1/kpis/notificaciones-por-canal` | Canal de mayor alcance |
| `GET` | `/api/v1/kpis/cuentas-por-sucursal` | Captación por sucursal (Top 20) |
| `GET` | `/api/v1/kpis/nomina-resumen` | Penetración de nómina BBVA |
| `GET` | `/api/v1/kpis/utilizacion-credito` | Utilización por tipo de tarjeta |
| `GET` | `/api/v1/kpis/utilizacion-credito/resumen` | Utilización global |
| `GET` | `/api/v1/kpis/morosidad-tarjetas` | Tasa de morosidad por tipo |
| `GET` | `/api/v1/kpis/morosidad-tarjetas/resumen` | Morosidad global |
| `GET` | `/api/v1/kpis/tasa-interes-prestamos` | Pricing de crédito por producto |
| `GET` | `/api/v1/kpis/metas-ahorro-por-estatus` | Completadas vs fallidas |
| `GET` | `/api/v1/kpis/metas-ahorro-progreso` | Progreso promedio de metas activas |
| `GET` | `/api/v1/kpis/resumen-periodo` | KPIs filtrados por `desde` y `hasta` |

### Clientes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/clientes` | Lista paginada. Params: `page`, `limit`, `nombre`, `segmento`, `riesgo` |
| `GET` | `/api/v1/clientes/:id` | Perfil completo con datos personales, negocio y open data |
| `GET` | `/api/v1/clientes/:id/cuentas` | Cuentas del cliente |
| `GET` | `/api/v1/clientes/:id/transacciones` | Últimas transacciones. Param: `limit` |
| `GET` | `/api/v1/clientes/:id/prestamos` | Préstamos activos e históricos |
| `GET` | `/api/v1/clientes/:id/tarjetas` | Tarjetas asociadas |
| `GET` | `/api/v1/clientes/:id/metas-ahorro` | Metas de ahorro ordenadas por fecha objetivo |

### Transacciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/transacciones` | Lista con filtros: `desde`, `hasta`, `categoria`, `canal`, `fraude`, `tipo` |
| `GET` | `/api/v1/transacciones/:id` | Detalle de una transacción con datos del cliente |

### ETL — Análisis de Fraude

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/etl/resumen` | KPIs globales del pipeline |
| `GET` | `/api/v1/etl/fraude-por-categoria` | Fraude agrupado por categoría |
| `GET` | `/api/v1/etl/fraude-por-canal` | Fraude por canal |
| `GET` | `/api/v1/etl/fraude-por-mes` | Tendencia mensual (36 meses) |
| `GET` | `/api/v1/etl/alertas-fraude` | Lista paginada de alertas. Params: `page`, `limit` |
| `GET` | `/api/v1/etl/fraude-geografico` | Clusters de fraude por coordenada |
| `GET` | `/api/v1/etl/fraude-por-comercio` | Top 20 comercios con más fraude |

### Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/reportes/kpis` | Descarga PDF ejecutivo. Params booleanos: `kpis`, `fraude`, `graficas`, `debilidades`, `recomendaciones` |

### IA

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/ai/chat` | Body: `{ mensaje, historial[] }` → respuesta del modelo |
| `GET` | `/api/v1/ai/status` | Verifica disponibilidad de Ollama y lista modelos |

---

## Proceso ETL

El pipeline ETL es independiente del backend y se ejecuta en Python. Consta de tres fases:

### Fase 1 — Extracción (`extraccion_etl.py`)

Lee **dos fuentes de datos** y las exporta como CSV:

**Fuente 1: PostgreSQL (`bbva_v2`)**
Extrae las 15 tablas del sistema bancario usando `SQLAlchemy` y `pandas.read_sql_table`. Cada tabla se guarda en `datos_extraidos/<tabla>.csv`.

**Fuente 2: CSV externo (Banxico)**
Lee el archivo `tipo_cambio_banxico.csv` con la serie histórica diaria del tipo de cambio MXN/USD (CF373) del Banco de México (2022–2024). Normaliza fechas (`dd/mm/yyyy` → `yyyy-mm-dd`) y columnas, luego lo une con los demás CSV.

```
Resultado → datos_extraidos/
├── clientes.csv, cuentas.csv, transacciones.csv ...
└── tipo_cambio_banxico.csv
```

### Fase 2 — Transformación (`transformacion_etl.py`)

Aplica **4 reglas de detección de fraude** basadas en datos propios (sin usar el campo `es_fraude_potencial` de la BD):

| Regla | Descripción | Puntos |
|-------|-------------|--------|
| **R1 — Anomalía geográfica** | Distancia Haversine entre coordenada de la transacción y ubicación habitual del cliente > 100 km | 3 pts |
| **R2 — Alta velocidad** | Más de 3 transacciones en 1 hora para el mismo cliente (rolling window) | 2 pts |
| **R3 — Monto anómalo** | Z-score del monto respecto al promedio del cliente > 3 desviaciones estándar | 2 pts |
| **R4 — Hora inusual** | Transacción entre 01:00 y 05:00 h | 1 pt |

**Score ≥ 3 → Alerta de fraude**

El enriquecimiento final cruza las transacciones con datos de clientes, cuentas y tipo de cambio para calcular el equivalente en USD de cada fraude detectado.

```
Resultado → datos_transformados/
├── alertas_fraude.csv          ← ~20,321 alertas con monto en USD
├── fraude_por_categoria.csv    ← 10 categorías de comercio
├── fraude_por_canal.csv        ← 5 canales con porcentaje
├── fraude_por_mes.csv          ← Tendencia 2022–2024 (36 meses)
└── resumen_general.csv         ← KPIs: tasa, montos, score umbral
```

### Fase 3 — Carga (`carga_etl.py`)

Carga los 5 datasets transformados a PostgreSQL usando `to_sql()` con `if_exists='replace'`, lo que permite re-ejecutar el pipeline sin conflictos. Las tablas se crean en el schema `public` con prefijo `etl_*` y luego son consultadas por el backend a través de vistas en el schema `dwh`.

```
PostgreSQL bbva_v2
├── public.etl_alertas_fraude
├── public.etl_fraude_por_categoria
├── public.etl_fraude_por_canal
├── public.etl_fraude_por_mes
└── public.etl_resumen_general
```

### Cómo ejecutar el ETL

```bash
# 1. Configurar entorno (solo la primera vez)
python3 setup.py

# 2. Configurar credenciales
cp .env.example .env
# Editar .env con los datos de la BD

# 3. Extraer datos
venv/bin/python extraccion_etl.py

# 4. Transformar y detectar fraudes
venv/bin/python transformacion_etl.py

# 5. Cargar resultados a PostgreSQL
venv/bin/python carga_etl.py
```

---

## Módulo de IA (Ollama)

El módulo de IA usa **Ollama con llama3.1:8b** ejecutándose localmente, sin costo ni internet. En cada conversación:

1. El servicio recopila **contexto histórico en tiempo real** directamente de PostgreSQL: series anuales de cuentas, transacciones, préstamos, cobros, pagos, metas, seguros, tendencia mensual de fraude (DWH), distribución de scores y segmentos.
2. Construye un prompt de sistema estructurado con todos esos datos formateados.
3. Envía el historial de la conversación (últimos 6 mensajes) más el nuevo mensaje al modelo.
4. El modelo responde como "analista financiero senior especializado en banca retail mexicana".

```typescript
// Parámetros del modelo
temperature: 0.2   // Determinista para análisis con números exactos
num_predict: 768   // Suficiente para respuestas con tablas y comparaciones
```

### Configuración de Ollama

```bash
# Instalar
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelo
ollama pull llama3.1:8b

# Configurar para Docker (escuchar en todas las interfaces)
sudo systemctl edit ollama
# Agregar: Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama
```

En `docker-compose.yml` se pasa `OLLAMA_HOST: http://host.docker.internal:11434` y se agrega `extra_hosts: - "host.docker.internal:host-gateway"` para que el contenedor alcance el host.

---

## Instalación y puesta en marcha

### Requisitos

- Docker + Docker Compose
- Los archivos SQL de la BD (proporcionados por el equipo del proyecto)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/KyriuxDev/bbva_back.git bbva-backend
cd bbva-backend

# 2. Colocar los archivos SQL
# Copiar 01_bbva.sql, 02_admins.sql y 03_dwh.sql en:
docker/init/

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales del equipo

# 4. Levantar todo
docker compose up --build
```

Cuando aparezca en consola:

```
✅ Admin creado: admin@bbva.com
🚀 Servidor corriendo en http://localhost:3000
📄 Swagger UI en http://localhost:3000/api/docs
```

el backend está listo.

### Credenciales iniciales

| Campo | Valor |
|-------|-------|
| Email | `admin@bbva.com` |
| Password | `Admin123!` |

### Comandos del día a día

```bash
docker compose up -d                              # Levantar en background
docker compose down                               # Detener (conserva datos)
docker compose down -v                            # Detener + borrar BD
docker compose logs api -f                        # Logs del backend en vivo
docker compose exec api npx prisma studio         # Explorador visual de BD
```

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://postgres:pass@127.0.0.1:5433/bbva_v2` |
| `JWT_SECRET` | Clave secreta para firmar tokens | `cadena_larga_y_segura` |
| `JWT_EXPIRES_IN` | Duración del token | `8h` |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `APP_NAME` | Nombre de la app (Swagger) | `BBVA Dashboard API` |
| `APP_DESCRIPTION` | Descripción (Swagger) | `API de KPIs y reportes` |
| `APP_VERSION` | Versión (Swagger) | `1.0.0` |
| `OLLAMA_HOST` | URL del servidor Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo a usar | `llama3.1:8b` |

---

## Autenticación JWT

El flujo de autenticación es stateless:

```
POST /api/v1/auth/login
{ "email": "admin@bbva.com", "password": "Admin123!" }

→ 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": { "id": 1, "email": "admin@bbva.com", "nombre": "Administrador BBVA" }
}
```

El token debe enviarse en todas las peticiones subsecuentes:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

El middleware `authMiddleware` verifica la firma con `JWT_SECRET` y adjunta el payload al objeto `req.admin`.

---

## Generación de reportes PDF

El módulo de reportes usa **PDFKit** para generar documentos binarios en memoria y transmitirlos como stream al cliente. Incluye:

- **Tarjetas de resumen** con valores formateados en MXN
- **Tablas** de tendencia mensual y segmentación de clientes
- **Gráficas de barras horizontales** (H) para distribuciones
- **Gráficas de barras verticales** (V) para series temporales
- **Sección de fraude** con nivel de riesgo visual (ALTO / MEDIO / BAJO)
- **Indicadores de riesgo** con semáforo de colores
- **Tarjetas de soluciones** con prioridad y descripción de acción

Se puede controlar qué secciones incluir con query params booleanos:

```
GET /api/v1/reportes/kpis?kpis=true&fraude=true&graficas=true&debilidades=true&recomendaciones=true
```

---

## Documentación Swagger

La documentación interactiva está disponible en:

```
http://localhost:3000/api/docs
```

Permite probar todos los endpoints directamente desde el navegador usando el token JWT obtenido en `/auth/login`.

---

## Análisis de debilidades automático

El endpoint `/api/v1/kpis/debilidades` calcula cinco indicadores y genera recomendaciones priorizadas automáticamente:

| Indicador | Umbral | Prioridad |
|-----------|--------|-----------|
| % transacciones con fraude potencial | > 5% | Alta |
| % cobros que exceden límite legal | > 10% | Alta |
| % cuentas canceladas | > 20% | Media |
| % préstamos vencidos | > 15% | Alta |
| % metas de ahorro fallidas | > 30% | Baja |

Cuando un indicador supera su umbral, el sistema genera automáticamente una solución con `area`, `problema`, `solucion` y `prioridad`.

---

*DSD-2303 · Desarrollo de Servicios Web · Instituto Tecnológico de Oaxaca*