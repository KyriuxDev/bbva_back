# BBVA Backend — Guía para el equipo

## Requisitos
- Docker Desktop (Mac/Windows) o Docker Engine (Linux)
- Git

## Levantar el proyecto

### 1. Clonar
```bash
git clone <url-del-repo>
cd bbva
```

### 2. Importar los datos de BBVA (solo la primera vez)
```bash
# Copiar el dump SQL a la carpeta de init
cp esquema_bbva.sql docker/init/01_bbva.sql
```
> El número al inicio (01_) define el orden de ejecución.
> Prisma seed corre después automáticamente.

### 3. Levantar todo
```bash
docker compose up --build
```

Cuando veas esto, está listo:
```
bbva_api  | 🚀 Servidor corriendo en http://localhost:3000
bbva_api  | 📄 Swagger UI en http://localhost:3000/api/docs
```

### 4. Seed (primer admin)
En otra terminal:
```bash
docker compose exec api npx prisma db seed
```

## URLs
| Servicio   | URL                              |
|------------|----------------------------------|
| API REST   | http://localhost:3000/api/v1     |
| Swagger    | http://localhost:3000/api/docs   |
| PostgreSQL | localhost:5432 / bbva_v2         |

## Login de prueba
- Email: admin@bbva.com
- Password: Admin123!

## Comandos útiles
```bash
docker compose up -d          # levantar en background
docker compose down           # detener
docker compose down -v        # detener + borrar datos
docker compose logs api -f    # ver logs del backend
docker compose exec api npx prisma studio  # explorador BD
```

## Para Expo (app móvil)
La app no puede usar 'localhost' — necesita la IP de tu máquina:

**Mac/Linux:**
```bash
ipconfig getifaddr en0   # Mac
ip route get 1 | awk '{print $7}' | head -1  # Linux
```

**Windows:**
```bash
ipconfig | findstr IPv4
```

Usa esa IP en tu archivo de configuración de Expo:
```typescript
// src/config/api.ts
export const API_URL = 'http://192.168.1.X:3000/api/v1';
```
