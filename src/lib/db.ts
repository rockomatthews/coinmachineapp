import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'minimal',
})

export { prisma } 