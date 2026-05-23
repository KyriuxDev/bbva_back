import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.admin.create({
    data: {
      email:    'admin@bbva.com',
      password: passwordHash,
      nombre:   'Administrador BBVA',
      isActive: true,
    },
  });

  console.log('✅ Admin creado:', admin.email);
}

main()
  .catch((e) => {
    if (e.code === 'P2002') {
      console.log('ℹ️  Admin ya existe, omitiendo...');
    } else {
      console.error(e);
      process.exit(1);
    }
  })
  .finally(() => prisma.$disconnect());
