import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const email = process.env.SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PASSWORD;
  if (process.env.NODE_ENV === 'production') throw new Error('Seed is disabled in production.');
  if (!email || !password || password.length < 12) {
    throw new Error('Set SEED_EMAIL and a unique SEED_PASSWORD of at least 12 characters.');
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Trader',
      password: hashedPassword,
      role: 'user',
      balance: 100000,
      initialBalance: 100000,
    },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
