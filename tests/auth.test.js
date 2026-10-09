const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')

beforeEach(async () => {
  await prisma.note.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /auth/register', () => {
  it('creates a user and returns 201 without password field', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password: 'secret123' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ email: 'alice@example.com', name: 'Alice' })
    expect(res.body.password).toBeUndefined()
    expect(res.body.id).toBeDefined()
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'email, name, and password are required' })
  })

  it('returns 400 when email already registered', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password: 'secret123' })
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password: 'secret123' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Email already registered' })
  })
})

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password: 'secret123' })
  })

  it('returns a token with valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'secret123' })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(0)
  })

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpassword' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid credentials' })
  })

  it('returns 401 with unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret123' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid credentials' })
  })
})
