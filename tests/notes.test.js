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

describe('GET /notes/:id', () => {
  it('returns a note by id', async () => {
    const created = await request(app).post('/notes').send({
      email: 'bob@example.com',
      name: 'Bob',
      title: 'My Note',
      body: 'Content here',
      categoryId: engineeringCategoryId
    })
    const res = await request(app).get(`/notes/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'My Note',
      user: { email: 'bob@example.com' },
      category: { name: 'engineering' }
    })
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/notes/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Note not found' })
  })
})

describe('GET /notes/user/:email', () => {
  it('returns all notes for a user', async () => {
    await request(app).post('/notes').send({
      email: 'carol@example.com', name: 'Carol',
      title: 'Note A', body: 'Body A', categoryId: engineeringCategoryId
    })
    await request(app).post('/notes').send({
      email: 'carol@example.com', name: 'Carol',
      title: 'Note B', body: 'Body B', categoryId: engineeringCategoryId
    })
    const res = await request(app).get('/notes/user/carol@example.com')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
    expect(res.body[0]).toMatchObject({ user: { email: 'carol@example.com' } })
  })

  it('returns empty array for user with no notes', async () => {
    const res = await request(app).get('/notes/user/nobody@example.com')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /notes/category/:categoryName', () => {
  it('returns all notes in a category', async () => {
    await request(app).post('/notes').send({
      email: 'dave@example.com', name: 'Dave',
      title: 'Eng Note', body: 'Body', categoryId: engineeringCategoryId
    })
    const res = await request(app).get('/notes/category/engineering')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    expect(res.body[0]).toMatchObject({ category: { name: 'engineering' } })
  })

  it('returns 404 for unknown category', async () => {
    const res = await request(app).get('/notes/category/nonexistent')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Category not found' })
  })
})

describe('GET /notes/user/:email/category/:categoryName', () => {
  it('returns notes filtered by user and category', async () => {
    await request(app).post('/notes').send({
      email: 'eve@example.com', name: 'Eve',
      title: 'Eng Note', body: 'Body', categoryId: engineeringCategoryId
    })
    const res = await request(app).get('/notes/user/eve@example.com/category/engineering')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toMatchObject({
      title: 'Eng Note',
      user: { email: 'eve@example.com' },
      category: { name: 'engineering' }
    })
  })

  it('returns empty array when no matching notes', async () => {
    const res = await request(app).get('/notes/user/eve@example.com/category/sales')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
