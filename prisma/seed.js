require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const categories = ['marketing', 'sales', 'engineering', 'hr', 'personal', 'miscellaneous']
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    })
  }
  console.log('Seeded categories:', categories.join(', '))

  const demoPassword = await bcrypt.hash('demo123', 10)
  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: demoPassword
    }
  })
  console.log('Seeded demo user: demo@example.com / demo123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
