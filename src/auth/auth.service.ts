// Lógica de autenticación de administradores.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { config } from '../config';
import { LoginInput } from './auth.schema';

export const authService = {
  login: async (data: LoginInput) => {
    const admin = await prisma.admin.findUnique({ where: { email: data.email } });

    if (!admin || !admin.isActive) {
      throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
    }

    const passwordOk = await bcrypt.compare(data.password, admin.password);
    if (!passwordOk) {
      throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
    );

    return {
      token,
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre },
    };
  },

  // Útil al registrar el primer admin (ejecutar una vez desde consola/seed)
  hashPassword: (plain: string) => bcrypt.hash(plain, 10),
};
