import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  DATABASE_URL:    z.string().url(),
  JWT_SECRET:      z.string().min(1),
  JWT_EXPIRES_IN:  z.string().min(1),
  PORT:            z.string().default('3000'),
  NODE_ENV:        z.enum(['development', 'production', 'test']),
  APP_NAME:        z.string().min(1),
  APP_DESCRIPTION: z.string().min(1),
  APP_VERSION:     z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const config = parsed.data;
