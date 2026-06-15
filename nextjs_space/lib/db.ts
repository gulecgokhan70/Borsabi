import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connection_limit=10&pool_timeout=30'
    }
  }
})

// Production'da da singleton kullan (VPS'de önemli)
globalForPrisma.prisma = prisma
