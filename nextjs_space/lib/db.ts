import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbUrl = process.env.DATABASE_URL || ''
const separator = dbUrl.includes('?') ? '&' : '?'
const fullUrl = dbUrl + separator + 'connection_limit=10&pool_timeout=30'

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: fullUrl
    }
  }
})

// Production'da da singleton kullan
globalForPrisma.prisma = prisma
