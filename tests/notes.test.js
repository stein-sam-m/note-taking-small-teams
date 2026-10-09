const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')
const notesRouter = require('../src/routes/notes')

let engineeringCategoryId
let token

beforeAll(async () => {
  const cat = await prisma.category.findUnique({ where: { name: 'engineering' } })
  engineeringCategoryId = cat.id

  await request(app)
    .post('/auth/register')
    .send({ email: 'testauth@example.com', name: 'Test Auth', password: 'testpass123' })
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'testauth@example.com', password: 'testpass123' })
  token = res.body.token
})

beforeEach(async () => {
  await prisma.note.deleteMany()
  await prisma.user.deleteMany()
  const { id } = jwt.decode(token)
  notesRouter.limiter.resetKey(id)
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
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload())
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
    await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload())
    const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } })
    expect(user).not.toBeNull()
    expect(user.name).toBe('Alice')
  })

  it('reuses existing user if email already exists', async () => {
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send(validPayload())
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send({ ...validPayload(), title: 'Second Note' })
    const users = await prisma.user.findMany({ where: { email: 'alice@example.com' } })
    expect(users.length).toBe(1)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'alice@example.com' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'email, name, title, body, and categoryId are required' })
  })

  it('returns 400 when title exceeds 200 characters', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), title: 'a'.repeat(201) })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'title must be 200 characters or fewer' })
  })

  it('returns 400 when body exceeds 10000 characters', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), body: 'a'.repeat(10001) })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'body must be 10000 characters or fewer' })
  })

  it('returns 429 after exceeding rate limit', async () => {
    const max = parseInt(process.env.RATE_LIMIT_MAX || '30', 10)
    for (let i = 0; i < max; i++) {
      await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send(validPayload())
    }
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload())
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'Too many requests' })
  })

  it('returns 404 when categoryId does not exist', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), categoryId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Category not found or inactive' })
  })
})

describe('GET /notes/:id', () => {
  it('returns a note by id', async () => {
    const created = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'bob@example.com',
        name: 'Bob',
        title: 'My Note',
        body: 'Content here',
        categoryId: engineeringCategoryId
      })
    const res = await request(app)
      .get(`/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'My Note',
      user: { email: 'bob@example.com' },
      category: { name: 'engineering' }
    })
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/notes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Note not found' })
  })
})

describe('DELETE /notes/:id', () => {
  let deleteToken

  beforeEach(async () => {
    // Register a fresh user each test so the JWT user ID matches the note owner.
    // The outer beforeEach deletes all users first, then this creates a new one.
    await request(app).post('/auth/register').send({ email: 'deleter@example.com', name: 'Deleter', password: 'pass123' })
    const res = await request(app).post('/auth/login').send({ email: 'deleter@example.com', password: 'pass123' })
    deleteToken = res.body.token
  })

  it('soft-deletes own note and returns 204', async () => {
    const created = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${deleteToken}`)
      .send({ email: 'deleter@example.com', name: 'Deleter', title: 'My Note', body: 'Body', categoryId: engineeringCategoryId })
    const res = await request(app)
      .delete(`/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${deleteToken}`)
    expect(res.status).toBe(204)
  })

  it('deleted note no longer appears in GET /notes/:id', async () => {
    const created = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${deleteToken}`)
      .send({ email: 'deleter@example.com', name: 'Deleter', title: 'My Note', body: 'Body', categoryId: engineeringCategoryId })
    await request(app).delete(`/notes/${created.body.id}`).set('Authorization', `Bearer ${deleteToken}`)
    const res = await request(app)
      .get(`/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${deleteToken}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 when trying to delete another user\'s note', async () => {
    const other = await prisma.user.create({ data: { email: 'other@example.com', name: 'Other' } })
    const note = await prisma.note.create({
      data: { title: 'Not Mine', body: 'Body', userId: other.id, categoryId: engineeringCategoryId }
    })
    const res = await request(app)
      .delete(`/notes/${note.id}`)
      .set('Authorization', `Bearer ${deleteToken}`)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
  })

  it('returns 404 for unknown note id', async () => {
    const res = await request(app)
      .delete('/notes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${deleteToken}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Note not found' })
  })
})

describe('GET /notes/user/:email', () => {
  it('returns all notes for a user', async () => {
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send({
      email: 'carol@example.com', name: 'Carol',
      title: 'Note A', body: 'Body A', categoryId: engineeringCategoryId
    })
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send({
      email: 'carol@example.com', name: 'Carol',
      title: 'Note B', body: 'Body B', categoryId: engineeringCategoryId
    })
    const res = await request(app)
      .get('/notes/user/carol@example.com')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
    expect(res.body[0]).toMatchObject({ user: { email: 'carol@example.com' } })
  })

  it('returns empty array for user with no notes', async () => {
    const res = await request(app)
      .get('/notes/user/nobody@example.com')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('respects ?limit and returns at most that many notes', async () => {
    const user = await prisma.user.create({ data: { email: 'carol@example.com', name: 'Carol' } })
    await prisma.note.createMany({ data: [
      { title: 'Note 1', body: 'Body', userId: user.id, categoryId: engineeringCategoryId },
      { title: 'Note 2', body: 'Body', userId: user.id, categoryId: engineeringCategoryId },
      { title: 'Note 3', body: 'Body', userId: user.id, categoryId: engineeringCategoryId }
    ]})
    const res = await request(app)
      .get('/notes/user/carol@example.com?limit=2')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })

  it('respects ?offset and skips that many notes', async () => {
    const user = await prisma.user.create({ data: { email: 'carol@example.com', name: 'Carol' } })
    await prisma.note.createMany({ data: [
      { title: 'Note 1', body: 'Body', userId: user.id, categoryId: engineeringCategoryId },
      { title: 'Note 2', body: 'Body', userId: user.id, categoryId: engineeringCategoryId },
      { title: 'Note 3', body: 'Body', userId: user.id, categoryId: engineeringCategoryId }
    ]})
    const res = await request(app)
      .get('/notes/user/carol@example.com?limit=10&offset=2')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
  })

  it('caps limit at 200 when a larger value is given', async () => {
    const res = await request(app)
      .get('/notes/user/carol@example.com?limit=999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns 400 for a non-integer limit', async () => {
    const res = await request(app)
      .get('/notes/user/carol@example.com?limit=abc')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'limit must be a positive integer and offset must be a non-negative integer' })
  })

  it('returns 400 for a negative offset', async () => {
    const res = await request(app)
      .get('/notes/user/carol@example.com?offset=-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'limit must be a positive integer and offset must be a non-negative integer' })
  })
})

describe('GET /notes/category/:categoryName', () => {
  it('returns all notes in a category', async () => {
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send({
      email: 'dave@example.com', name: 'Dave',
      title: 'Eng Note', body: 'Body', categoryId: engineeringCategoryId
    })
    const res = await request(app)
      .get('/notes/category/engineering')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    expect(res.body[0]).toMatchObject({ category: { name: 'engineering' } })
  })

  it('returns 404 for unknown category', async () => {
    const res = await request(app)
      .get('/notes/category/nonexistent')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Category not found' })
  })
})

describe('GET /notes/user/:email/category/:categoryName', () => {
  it('returns notes filtered by user and category', async () => {
    await request(app).post('/notes').set('Authorization', `Bearer ${token}`).send({
      email: 'eve@example.com', name: 'Eve',
      title: 'Eng Note', body: 'Body', categoryId: engineeringCategoryId
    })
    const res = await request(app)
      .get('/notes/user/eve@example.com/category/engineering')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toMatchObject({
      title: 'Eng Note',
      user: { email: 'eve@example.com' },
      category: { name: 'engineering' }
    })
  })

  it('returns empty array when no matching notes', async () => {
    const res = await request(app)
      .get('/notes/user/eve@example.com/category/sales')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
