const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')

let token

beforeAll(async () => {
  await request(app)
    .post('/auth/register')
    .send({ email: 'testauth@example.com', name: 'Test Auth', password: 'testpass123', clearanceLevelName: 'none' })
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'testauth@example.com', password: 'testpass123' })
  token = res.body.token
})

beforeEach(async () => {
  await prisma.note.deleteMany()
  await prisma.user.deleteMany()
  // leave categories — seeded data must stay intact
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /categories', () => {
  it('returns 200 with array of active categories', async () => {
    const res = await request(app)
      .get('/categories')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(6)
    expect(res.body[0]).toMatchObject({ name: expect.any(String), isActive: true })
  })
})

describe('POST /admin/categories', () => {
  it('creates a new category and returns 201', async () => {
    try {
      const res = await request(app)
        .post('/admin/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'legal' })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'legal', isActive: true })
    } finally {
      await prisma.category.deleteMany({ where: { name: 'legal' } })
    }
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'name is required' })
  })

  it('returns 400 when category name already exists', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'engineering' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Category already exists' })
  })
})
