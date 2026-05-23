import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.admin.upsert({
    where:  { email: 'admin@bbva.com' },
    update: {},                          // ya existe → no tocar nada
    create: {
      email:    'admin@bbva.com',
      password: passwordHash,
      nombre:   'Administrador BBVA',
      isActive: true,
    },
  });

  console.log('✅ Admin listo:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
