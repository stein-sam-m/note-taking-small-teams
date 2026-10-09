const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /categories', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/categories')
    expect(res.status).toBe(200)
  })
})
