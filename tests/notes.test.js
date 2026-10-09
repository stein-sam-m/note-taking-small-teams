const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')

let engineeringCategoryId

beforeAll(async () => {
  const cat = await prisma.category.findUnique({ where: { name: 'engineering' } })
  engineeringCategoryId = cat.id
})

beforeEach(async () => {
  await prisma.note.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /notes', () => {
  const validPayload = () => ({
    email: 'alice@example.com',
    name: 'Alice',
    title: 'First Note',
    body: 'Hello world',
    categoryId: engineeringCategoryId
  })

  it('creates a note and returns 201 with full note object', async () => {
    const res = await request(app).post('/notes').send(validPayload())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      title: 'First Note',
      body: 'Hello world',
      user: { email: 'alice@example.com', name: 'Alice' },
      category: { name: 'engineering' }
    })
    expect(res.body.id).toBeDefined()
  })

  it('creates a new user if email is new', async () => {
    await request(app).post('/notes').send(validPayload())
    const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } })
    expect(user).not.toBeNull()
    expect(user.name).toBe('Alice')
  })

  it('reuses existing user if email already exists', async () => {
    await request(app).post('/notes').send(validPayload())
    await request(app).post('/notes').send({ ...validPayload(), title: 'Second Note' })
    const users = await prisma.user.findMany({ where: { email: 'alice@example.com' } })
    expect(users.length).toBe(1)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/notes').send({ email: 'alice@example.com' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'email, name, title, body, and categoryId are required' })
  })

  it('returns 404 when categoryId does not exist', async () => {
    const res = await request(app)
      .post('/notes')
      .send({ ...validPayload(), categoryId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Category not found or inactive' })
  })
})
