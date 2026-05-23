# BBVA Dashboard — Backend API

Backend REST para el dashboard administrativo de análisis BBVA. Construido con Express 5, Prisma 7 y PostgreSQL. Expone KPIs, gráficas, reportes PDF y análisis de debilidades financieras.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 22 + TypeScript |
| Framework | Express 5 |
| ORM | Prisma 7 + adaptador pg |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT + bcryptjs |
| Validación | Zod |
| Reportes | PDFKit |
| Documentación | Swagger UI |
| Contenedores | Docker + Docker Compose |

---

## Archivos que necesitas recibir del equipo

Antes de levantar el proyecto necesitas dos archivos que **no están en el repositorio** por su tamaño.

```
01_bbva.sql      ← dump completo de la BD (estructura + 1M de registros)
02_admins.sql    ← tabla de administradores
```

Una vez que los tengas, colócalos exactamente aquí:

```
bbva-backend/
└── docker/
    └── init/
        ├── 01_bbva.sql     ← aquí
        └── 02_admins.sql   ← aquí
```

> Sin estos archivos el contenedor de PostgreSQL arranca vacío y el seed fallará.

---

## Estructura del proyecto

```
bbva/
├── src/
│   ├── app.ts                          ← Express + middlewares + routers
│   ├── server.ts                       ← Punto de entrada
│   ├── config.ts                       ← Variables de entorno validadas con Zod
│   ├── prisma.ts                       ← Cliente Prisma singleton
│   ├── middleware/
│   │   ├── auth.middleware.ts          ← Guard JWT
│   │   └── error.middleware.ts         ← Error handler global
│   ├── auth/
│   │   ├── auth.router.ts
│   │   ├── auth.service.ts
│   │   └── auth.schema.ts
│   ├── kpis/
│   │   ├── kpis.router.ts             ← 11 endpoints de dashboard
│   │   ├── kpis.service.ts            ← Análisis de debilidades automático
│   │   └── kpis.repository.ts         ← Queries SQL agregadas
│   ├── clientes/
│   │   ├── clientes.router.ts         ← Lista paginada + sub-rutas
│   │   ├── clientes.service.ts
│   │   └── clientes.repository.ts
│   ├── transacciones/
│   │   ├── transacciones.router.ts    ← Filtros por fecha/canal/categoría/fraude
│   │   ├── transacciones.service.ts
│   │   └── transacciones.repository.ts
│   └── reportes/
│       ├── reportes.router.ts         ← Descarga PDF
│       └── reportes.service.ts        ← Generación con PDFKit
├── prisma/
│   ├── schema.prisma                  ← 14 tablas BBVA + admins
│   ├── seed.ts                        ← Admin inicial
│   └── seed-data.ts                   ← Datos de prueba con Faker
├── docker/
│   └── init/                          ← Coloca aquí los .sql recibidos
├── docker-compose.yml
├── Dockerfile
├── prisma.config.ts
├── .env.example
└── tsconfig.json
```

---

## Base de datos — tablas principales

| Tabla | Registros | Descripción |
|-------|-----------|-------------|
| `clientes` | 50,000 | Entidad central |
| `transacciones` | 1,016,934 | Movimientos bancarios |
| `pagos` | 321,576 | Pagos realizados |
| `cobros` | 169,781 | Comisiones y cobros |
| `cuentas` | 127,203 | Cuentas bancarias |
| `prestamos` | 77,375 | Créditos activos |
| `notificaciones` | 35,297 | Alertas a clientes |
| `metas_ahorro` | 24,976 | Objetivos de ahorro |
| `seguros` | 22,618 | Pólizas |
| `tarjetas` | 20,252 | Tarjetas de crédito/débito |
| `financiaciones` | 15,147 | Financiamientos |
| `open_data` | 50,000 | Score crediticio y segmento |
| `datos_personales` | 50,000 | Contacto y ubicación |
| `auditoria_comisiones` | 50,000 | Registro de auditoría |
| `admins` | — | Usuarios del dashboard |

---

## Endpoints

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login → retorna JWT |
| GET | `/api/v1/auth/me` | Datos del admin autenticado |

### KPIs *(requieren JWT)*
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/kpis/resumen` | Tarjetas: clientes, saldo, fraudes, cobros |
| GET | `/api/v1/kpis/clientes-por-segmento` | Distribución por segmento |
| GET | `/api/v1/kpis/clientes-por-genero` | Distribución por género |
| GET | `/api/v1/kpis/transacciones-por-categoria` | Volumen y monto por categoría |
| GET | `/api/v1/kpis/transacciones-por-canal` | App, web, sucursal, cajero |
| GET | `/api/v1/kpis/tendencia` | Últimos 12 meses |
| GET | `/api/v1/kpis/prestamos-por-tipo` | Saldo por tipo de crédito |
| GET | `/api/v1/kpis/saldo-por-tipo-cuenta` | Saldo en cuentas activas |
| GET | `/api/v1/kpis/score-crediticio` | Distribución de scores |
| GET | `/api/v1/kpis/cobros-excedidos` | Comisiones fuera de límite legal |
| GET | `/api/v1/kpis/debilidades` | Análisis automático + soluciones priorizadas |

### Clientes *(requieren JWT)*
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/clientes` | Lista paginada — parámetros: `page`, `limit`, `nombre`, `segmento`, `riesgo` |
| GET | `/api/v1/clientes/:id` | Perfil completo |
| GET | `/api/v1/clientes/:id/cuentas` | Cuentas del cliente |
| GET | `/api/v1/clientes/:id/transacciones` | Últimas transacciones — parámetro: `limit` |
| GET | `/api/v1/clientes/:id/prestamos` | Préstamos |
| GET | `/api/v1/clientes/:id/tarjetas` | Tarjetas |
| GET | `/api/v1/clientes/:id/metas-ahorro` | Metas de ahorro |

### Transacciones *(requieren JWT)*
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/transacciones` | Lista — parámetros: `desde`, `hasta`, `categoria`, `canal`, `fraude`, `tipo` |
| GET | `/api/v1/transacciones/:id` | Detalle de transacción |

### Reportes *(requieren JWT)*
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/reportes/kpis` | Descarga PDF con KPIs + debilidades + soluciones |

---

## Instalación paso a paso

### Requisitos
- Docker + Docker Compose
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/KyriuxDev/bbva_back.git
cd bbva-backend
```

### 2. Colocar los archivos SQL

Solicita al encargado los archivos `01_bbva.sql` y `02_admins.sql` y colócalos en:

```bash
docker/init/01_bbva.sql
docker/init/02_admins.sql
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las credenciales del equipo
```

### 4. Levantar todo

```bash
docker compose up --build
```

Cuando veas esto, está listo:

```
✅ Admin creado: admin@bbva.com
🚀 Servidor corriendo en http://localhost:3000
📄 Swagger UI en http://localhost:3000/api/docs
```

### Credenciales iniciales

| Campo | Valor |
|-------|-------|
| Email | `admin@bbva.com` |
| Password | `Admin123!` |

---

## Comandos del día a día

```bash
docker compose up -d               # levantar en background
docker compose down                # detener (conserva datos)
docker compose down -v             # detener + borrar BD completa
docker compose logs api -f         # logs del backend en vivo
docker compose exec api npx prisma studio   # explorador visual de BD
```

---

## Conexión desde Expo

El dispositivo no puede usar `localhost`. Obtén tu IP local y úsala en Expo:

```bash
# Linux
ip route get 1 | awk '{print $7}' | head -1

# Mac
ipconfig getifaddr en0
```

```typescript
// src/config/api.ts en tu proyecto Expo
export const API_URL = 'http://192.168.X.X:3000/api/v1';
```

---

## Flujo de autenticación

```bash
# 1. Login
POST /api/v1/auth/login
{ "email": "admin@bbva.com", "password": "Admin123!" }
→ { "token": "eyJ...", "admin": { ... } }

# 2. Usar el token en todas las demás peticiones
Authorization: Bearer eyJ...
```

---

*DSD-2303 · Desarrollo de Servicios Web · Instituto Tecnológico de Oaxaca*
