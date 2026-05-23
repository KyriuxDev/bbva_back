import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { loginSchema } from './auth.schema';
import { authMiddleware } from '../middleware/auth.middleware';

export const authRouter = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login de administrador
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, retorna JWT
 *       401:
 *         description: Credenciales inválidas
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const result = await authService.login(parsed.data);
  res.json(result);
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Datos del admin autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payload del token
 *       401:
 *         description: No autorizado
 */
authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json(req.admin);
});
