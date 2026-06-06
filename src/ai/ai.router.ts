// src/ai/ai.router.ts
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

  // Verificar que Ollama esté disponible
  const disponible = await aiService.healthCheck();
  if (!disponible) {
    res.status(503).json({
      message: 'El servicio de IA no está disponible. Verifica que Ollama esté corriendo.',
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
  res.json({ 
    disponible, 
    modelos,
    modelo_activo: process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
  });
});