require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const categories = ['marketing', 'sales', 'engineering', 'hr', 'personal', 'miscellaneous']
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log('Seeded categories:', categories.join(', '))

  const levels = [
    { name: 'none', rank: 1 },
    { name: 'secret', rank: 2 },
    { name: 'top_secret', rank: 3 },
    { name: 'polygraph', rank: 4 }
  ]
  for (const { name, rank } of levels) {
    await prisma.clearanceLevel.upsert({ where: { name }, update: {}, create: { name, rank } })
  }
  console.log('Seeded clearance levels')

  const demoPassword = await bcrypt.hash('demo123', 10)
  const userData = [
    { email: 'demo@example.com', name: 'Demo User', clearanceLevelName: 'none' },
    { email: 'secret-user@example.com', name: 'Secret User', clearanceLevelName: 'secret' },
    { email: 'topsecret-user@example.com', name: 'Top Secret User', clearanceLevelName: 'top_secret' },
    { email: 'polygraph-user@example.com', name: 'Polygraph User', clearanceLevelName: 'polygraph' }
  ]
  for (const { email, name, clearanceLevelName } of userData) {
    const cl = await prisma.clearanceLevel.findUnique({ where: { name: clearanceLevelName } })
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, password: demoPassword, clearanceLevelId: cl.id }
    })
  }
  console.log('Seeded users:', userData.map(u => u.email).join(', '))

  const noteCount = await prisma.note.count()
  if (noteCount === 0) {
    const engineeringCat = await prisma.category.findUnique({ where: { name: 'engineering' } })
    const noteData = [
      { email: 'demo@example.com', title: 'None Note 1', body: 'Unclassified content 1' },
      { email: 'demo@example.com', title: 'None Note 2', body: 'Unclassified content 2' },
      { email: 'secret-user@example.com', title: 'Secret Note 1', body: 'Secret content 1' },
      { email: 'secret-user@example.com', title: 'Secret Note 2', body: 'Secret content 2' },
      { email: 'topsecret-user@example.com', title: 'Top Secret Note 1', body: 'Top secret content 1' },
      { email: 'topsecret-user@example.com', title: 'Top Secret Note 2', body: 'Top secret content 2' },
      { email: 'polygraph-user@example.com', title: 'Polygraph Note 1', body: 'Polygraph content 1' },
      { email: 'polygraph-user@example.com', title: 'Polygraph Note 2', body: 'Polygraph content 2' }
    ]
    for (const { email, title, body } of noteData) {
      const user = await prisma.user.findUnique({ where: { email } })
      await prisma.note.create({
        data: {
          title, body,
          userId: user.id,
          categoryId: engineeringCat.id,
          clearanceLevelId: user.clearanceLevelId
        }
      })
    }
    console.log('Seeded 8 notes')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
