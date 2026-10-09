# Note-Taking Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a REST API for small teams to submit and retrieve categorized notes, backed by PostgreSQL via Prisma.

**Architecture:** Express handles routing; Prisma manages the schema, migrations, and queries; a central error handler normalizes all responses. Three domain objects — User, Category, Note — live in PostgreSQL with FK relationships. The app module is exported separately from the listen call so Supertest can import it without binding a port.

**Tech Stack:** Node.js v25+, Express 4.18, PostgreSQL 16, Prisma 5, Jest 29, Supertest 7, dotenv 16

**Spec:** `docs/superpowers/specs/2026-10-09-note-taking-backend-design.md`

## Global Constraints

- Node.js ≥ 25.0.0
- PostgreSQL 16 (installed via Homebrew)
- All endpoints return `Content-Type: application/json`
- All error responses: `{ "error": "<message>" }` with appropriate HTTP status code
- All primary keys are UUIDs (`@default(uuid())` in Prisma)
- No authentication in this iteration
- No pagination in this iteration

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies and npm scripts |
| `.env` | `DATABASE_URL` for local development |
| `.env.test` | `DATABASE_URL` pointing at test database |
| `prisma/schema.prisma` | Prisma data model: User, Category, Note |
| `prisma/seed.js` | Seeds 6 default categories on fresh DB |
| `src/index.js` | Express app: middleware, route mounting, conditional `listen` |
| `src/lib/prisma.js` | Singleton Prisma client instance |
| `src/middleware/errorHandler.js` | Central Express error handler |
| `src/routes/categories.js` | `GET /categories` and `POST /admin/categories` |
| `src/routes/notes.js` | All `/notes` endpoints (POST + 4 GETs) |
| `tests/setup.js` | Loaded by Jest before tests: sets `DATABASE_URL` from `.env.test` |
| `tests/categories.test.js` | Integration tests for category endpoints |
| `tests/notes.test.js` | Integration tests for note endpoints |
| `jest.config.js` | Jest configuration |

---

### Task 1: Infrastructure & Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.env.test`
- Create: `.gitignore`
- Create: `jest.config.js`
- Create: `tests/setup.js`

**Interfaces:**
- Produces: npm project with all dependencies installed; two PostgreSQL databases (`note_taking_dev`, `note_taking_test`); Jest configured to load `.env.test`

- [ ] **Step 1: Install PostgreSQL 16 via Homebrew**

```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Verify: `psql --version` should print `psql (PostgreSQL) 16.x`

- [ ] **Step 2: Create the development and test databases**

```bash
createdb note_taking_dev
createdb note_taking_test
```

- [ ] **Step 3: Initialize the npm project**

```bash
npm init -y
```

- [ ] **Step 4: Install production dependencies**

```bash
npm install express@4.18.2 @prisma/client@5.16.0 dotenv@16.4.5
```

- [ ] **Step 5: Install dev dependencies**

```bash
npm install --save-dev prisma@5.16.0 jest@29.7.0 supertest@7.0.0
```

- [ ] **Step 6: Write `.env`**

```
DATABASE_URL="postgresql://localhost:5432/note_taking_dev"
PORT=3000
```

- [ ] **Step 7: Write `.env.test`**

```
DATABASE_URL="postgresql://localhost:5432/note_taking_test"
```

- [ ] **Step 8: Write `jest.config.js`**

```js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js']
}
```

- [ ] **Step 9: Write `tests/setup.js`**

```js
require('dotenv').config({ path: '.env.test' })
```

- [ ] **Step 10: Update scripts in `package.json`**

Replace the `"scripts"` section with:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "node --watch src/index.js",
  "test": "jest",
  "seed": "node prisma/seed.js"
}
```

- [ ] **Step 11: Write `.gitignore`**

```
node_modules/
.env
.env.test
```

- [ ] **Step 12: Commit**

```bash
git add package.json jest.config.js tests/setup.js .gitignore
git commit -m "chore: scaffold project with dependencies and test infrastructure"
```

Do NOT commit `.env` or `.env.test` — they contain connection strings.

---

### Task 2: Prisma Schema, Migration & Seed

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.js`

**Interfaces:**
- Produces: Three tables in both databases (`User`, `Category`, `Note`); both DBs seeded with 6 categories; Prisma Client generated and importable

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma`. It will also append a `DATABASE_URL` hint to `.env` — that's fine, you already have `.env` set correctly.

- [ ] **Step 2: Replace `prisma/schema.prisma` with the full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  notes     Note[]
}

model Category {
  id        String   @id @default(uuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  notes     Note[]
}

model Note {
  id         String   @id @default(uuid())
  title      String
  body       String
  user       User     @relation(fields: [userId], references: [id])
  userId     String
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId String
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 3: Run migration on dev DB**

```bash
npx prisma migrate dev --name init
```

This creates `prisma/migrations/` and applies the schema to `note_taking_dev`. It also regenerates the Prisma Client.

- [ ] **Step 4: Apply migration to test DB**

```bash
DATABASE_URL="postgresql://localhost:5432/note_taking_test" npx prisma migrate deploy
```

- [ ] **Step 5: Write `prisma/seed.js`**

```js
const { PrismaClient } = require('@prisma/client')
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
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 6: Seed dev DB**

```bash
npm run seed
```

- [ ] **Step 7: Seed test DB**

```bash
DATABASE_URL="postgresql://localhost:5432/note_taking_test" npm run seed
```

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema, migration, and category seed"
```

---

### Task 3: App Skeleton

**Files:**
- Create: `src/lib/prisma.js`
- Create: `src/middleware/errorHandler.js`
- Create: `src/index.js`
- Create: `tests/categories.test.js` (skeleton only — used to verify app loads)

**Interfaces:**
- Produces: Running Express server on port 3000; shared Prisma client at `src/lib/prisma.js`; central error handler at `src/middleware/errorHandler.js`

- [ ] **Step 1: Write `src/lib/prisma.js`**

```js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
module.exports = prisma
```

- [ ] **Step 2: Write `src/middleware/errorHandler.js`**

```js
function errorHandler(err, req, res, next) {
  console.error(err.stack)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
}

module.exports = errorHandler
```

- [ ] **Step 3: Write a failing smoke test in `tests/categories.test.js`**

```js
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
```

- [ ] **Step 4: Run test — confirm it fails with module not found**

```bash
npm test -- tests/categories.test.js
```

Expected: FAIL — `Cannot find module '../src/index'`

- [ ] **Step 5: Write `src/index.js`**

```js
require('dotenv').config()
const express = require('express')
const errorHandler = require('./middleware/errorHandler')

const app = express()
app.use(express.json())

app.use(errorHandler)

if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
```

- [ ] **Step 6: Run test — confirm it fails with 404 (routes not mounted yet)**

```bash
npm test -- tests/categories.test.js
```

Expected: FAIL — `expected 404 to equal 200`

This confirms the app loads cleanly. The 404 is expected — `/categories` is not mounted yet.

- [ ] **Step 7: Commit**

```bash
git add src/ tests/categories.test.js
git commit -m "feat: add Express skeleton with error handler and Prisma client"
```

---

### Task 4: Categories Routes

**Files:**
- Create: `src/routes/categories.js`
- Modify: `src/index.js` — mount categories router
- Modify: `tests/categories.test.js` — add full test suite

**Interfaces:**
- Consumes: `src/lib/prisma` — Prisma client
- Produces:
  - `GET /categories` → `200 [{ id, name, isActive, createdAt }, ...]`
  - `POST /admin/categories` body `{ name: string }` → `201 { id, name, isActive, createdAt }` or `400 { error }` on missing name or duplicate

- [ ] **Step 1: Replace `tests/categories.test.js` with the full test suite**

```js
const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/lib/prisma')

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
    const res = await request(app).get('/categories')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(6)
    expect(res.body[0]).toMatchObject({ name: expect.any(String), isActive: true })
  })
})

describe('POST /admin/categories', () => {
  it('creates a new category and returns 201', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .send({ name: 'legal' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'legal', isActive: true })

    await prisma.category.delete({ where: { name: 'legal' } })
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'name is required' })
  })

  it('returns 400 when category name already exists', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .send({ name: 'engineering' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Category already exists' })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- tests/categories.test.js
```

Expected: FAIL — routes not mounted

- [ ] **Step 3: Write `src/routes/categories.js`**

```js
const { Router } = require('express')
const prisma = require('../lib/prisma')

const router = Router()

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ where: { isActive: true } })
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

router.post('/admin/categories', async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name) {
      const err = new Error('name is required')
      err.status = 400
      return next(err)
    }
    const category = await prisma.category.create({ data: { name } })
    res.status(201).json(category)
  } catch (err) {
    if (err.code === 'P2002') {
      const e = new Error('Category already exists')
      e.status = 400
      return next(e)
    }
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Mount the categories router in `src/index.js`**

```js
require('dotenv').config()
const express = require('express')
const categoriesRouter = require('./routes/categories')
const errorHandler = require('./middleware/errorHandler')

const app = express()
app.use(express.json())

app.use('/', categoriesRouter)

app.use(errorHandler)

if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npm test -- tests/categories.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/routes/categories.js src/index.js tests/categories.test.js
git commit -m "feat: add GET /categories and POST /admin/categories"
```

---

### Task 5: POST /notes

**Files:**
- Create: `src/routes/notes.js`
- Modify: `src/index.js` — mount notes router
- Create: `tests/notes.test.js`

**Interfaces:**
- Consumes: `src/lib/prisma` — Prisma client
- Produces:
  - `POST /notes` body `{ email, name, title, body, categoryId }` → `201 { id, title, body, categoryId, userId, createdAt, user: { id, email, name, createdAt }, category: { id, name, isActive, createdAt } }`
  - `400 { error: "email, name, title, body, and categoryId are required" }` when any field missing
  - `404 { error: "Category not found or inactive" }` when categoryId invalid

- [ ] **Step 1: Write `tests/notes.test.js` with POST tests**

```js
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- tests/notes.test.js
```

Expected: FAIL — `POST /notes` route doesn't exist

- [ ] **Step 3: Write `src/routes/notes.js` with POST route**

```js
const { Router } = require('express')
const prisma = require('../lib/prisma')

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    const { email, name, title, body, categoryId } = req.body

    if (!email || !name || !title || !body || !categoryId) {
      const err = new Error('email, name, title, body, and categoryId are required')
      err.status = 400
      return next(err)
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, isActive: true }
    })
    if (!category) {
      const err = new Error('Category not found or inactive')
      err.status = 404
      return next(err)
    }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({ data: { email, name } })
    }

    const note = await prisma.note.create({
      data: { title, body, userId: user.id, categoryId: category.id },
      include: { user: true, category: true }
    })

    res.status(201).json(note)
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Mount the notes router in `src/index.js`**

```js
require('dotenv').config()
const express = require('express')
const categoriesRouter = require('./routes/categories')
const notesRouter = require('./routes/notes')
const errorHandler = require('./middleware/errorHandler')

const app = express()
app.use(express.json())

app.use('/', categoriesRouter)
app.use('/notes', notesRouter)

app.use(errorHandler)

if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
```

- [ ] **Step 5: Run all tests — confirm they pass**

```bash
npm test
```

Expected: PASS (all tests including categories)

- [ ] **Step 6: Commit**

```bash
git add src/routes/notes.js src/index.js tests/notes.test.js
git commit -m "feat: add POST /notes with user upsert logic"
```

---

### Task 6: Notes Read Routes

**Files:**
- Modify: `src/routes/notes.js` — add 4 GET routes
- Modify: `tests/notes.test.js` — add GET test suites

**Interfaces:**
- Consumes: `src/lib/prisma`
- Produces:
  - `GET /notes/:id` → `200 { ...note, user, category }` or `404 { error: "Note not found" }`
  - `GET /notes/user/:email` → `200 [{ ...note, user, category }, ...]` (empty array if user unknown)
  - `GET /notes/category/:categoryName` → `200 [{ ...note, user, category }, ...]` or `404 { error: "Category not found" }`
  - `GET /notes/user/:email/category/:categoryName` → `200 [{ ...note, user, category }, ...]` (empty array if no match)

**Critical route ordering:** Express matches routes in definition order. `/:id` will greedily match the literal string `"user"` and `"category"`. The three specific routes MUST be defined BEFORE `/:id` in `src/routes/notes.js`.

- [ ] **Step 1: Append GET test suites to `tests/notes.test.js`**

Add after the closing `})` of the `describe('POST /notes', ...)` block:

```js
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
    expect(res.body).toMatchObject({ id: created.body.id, title: 'My Note' })
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
```

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
npm test -- tests/notes.test.js
```

Expected: FAIL — GET routes not yet defined

- [ ] **Step 3: Add GET routes to `src/routes/notes.js`**

Insert BEFORE the `router.post('/', ...)` block. Route order matters — most specific first.

```js
// IMPORTANT: These three routes must come before router.get('/:id')
// because Express matches routes in definition order and /:id would
// match the literal strings "user" and "category".

router.get('/user/:email/category/:categoryName', async (req, res, next) => {
  try {
    const { email, categoryName } = req.params
    const category = await prisma.category.findFirst({
      where: { name: categoryName, isActive: true }
    })
    if (!category) {
      return res.json([])
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json([])
    }
    const notes = await prisma.note.findMany({
      where: { userId: user.id, categoryId: category.id },
      include: { user: true, category: true }
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/user/:email', async (req, res, next) => {
  try {
    const { email } = req.params
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json([])
    }
    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      include: { user: true, category: true }
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/category/:categoryName', async (req, res, next) => {
  try {
    const { categoryName } = req.params
    const category = await prisma.category.findFirst({
      where: { name: categoryName, isActive: true }
    })
    if (!category) {
      const err = new Error('Category not found')
      err.status = 404
      return next(err)
    }
    const notes = await prisma.note.findMany({
      where: { categoryId: category.id },
      include: { user: true, category: true }
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const note = await prisma.note.findUnique({
      where: { id },
      include: { user: true, category: true }
    })
    if (!note) {
      const err = new Error('Note not found')
      err.status = 404
      return next(err)
    }
    res.json(note)
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: PASS (all tests across both test files)

- [ ] **Step 5: Manual smoke test**

```bash
npm start
# in a second terminal:
curl http://localhost:3000/categories
```

Expected: JSON array with 6 category objects.

- [ ] **Step 6: Commit**

```bash
git add src/routes/notes.js tests/notes.test.js
git commit -m "feat: add GET /notes read endpoints"
```
