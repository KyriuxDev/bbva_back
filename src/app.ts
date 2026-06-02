// Configura la instancia de Express: middlewares, routers y Swagger.

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

// Routers
import { authRouter }          from './auth/auth.router';
import { kpisRouter }          from './kpis/kpis.router';
import { clientesRouter }      from './clientes/clientes.router';
import { transaccionesRouter } from './transacciones/transacciones.router';
import { reportesRouter }      from './reportes/reportes.router';
import { etlRouter }           from './etl/etl.router';
import { aiRouter }             from './ai/ai.router';

// Middleware
import { errorMiddleware } from './middleware/error.middleware';

export const app = express();

// ── Middlewares globales ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Swagger ───────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       config.APP_NAME,
      description: config.APP_DESCRIPTION,
      version:     config.APP_VERSION,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth',          description: 'Autenticación de administradores' },
      { name: 'KPIs',          description: 'Indicadores clave del dashboard' },
      { name: 'Clientes',      description: 'Gestión y consulta de clientes' },
      { name: 'Transacciones', description: 'Historial de transacciones' },
      { name: 'Reportes',      description: 'Generación de reportes PDF' },
      { name: 'ETL',           description: 'Datos analíticos de fraude — pipeline Python' },
    ],
  },
  apis: ['./src/**/*.router.ts'],
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authRouter);
app.use('/api/v1/kpis',          kpisRouter);
app.use('/api/v1/clientes',      clientesRouter);
app.use('/api/v1/transacciones', transaccionesRouter);
app.use('/api/v1/reportes',      reportesRouter);
app.use('/api/v1/etl',          etlRouter);
app.use('/api/v1/ai', aiRouter);
// ── Error handler global (debe ir al final) ────────────────────────────────────
app.use(errorMiddleware);
