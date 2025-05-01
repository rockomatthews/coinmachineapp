import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create a test user
  const user = await prisma.user.upsert({
    where: { walletAddress: 'test_wallet_address' },
    update: {},
    create: {
      walletAddress: 'test_wallet_address',
      email: 'test@example.com',
      isVerified: true,
    },
  })

  console.log({ user })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 