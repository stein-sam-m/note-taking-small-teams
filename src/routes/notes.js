const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const prisma = require('../lib/prisma')

const noteSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  keyGenerator: (req) => req.user.id,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
  standardHeaders: false,
  legacyHeaders: false
})

const router = Router()

function parsePagination(query) {
  const limit = parseInt(query.limit ?? '50', 10)
  const offset = parseInt(query.offset ?? '0', 10)
  if (isNaN(limit) || limit < 1 || isNaN(offset) || offset < 0) {
    return { err: true }
  }
  return { limit: Math.min(limit, 200), offset }
}

// IMPORTANT: These three routes must come before router.get('/:id')
// because Express matches routes in definition order and /:id would
// match the literal strings "user" and "category".

router.get('/user/:email/category/:categoryName', async (req, res, next) => {
  try {
    const { limit, offset, err: pageErr } = parsePagination(req.query)
    if (pageErr) {
      const err = new Error('limit must be a positive integer and offset must be a non-negative integer')
      err.status = 400
      return next(err)
    }
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
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        category: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/user/:email', async (req, res, next) => {
  try {
    const { limit, offset, err: pageErr } = parsePagination(req.query)
    if (pageErr) {
      const err = new Error('limit must be a positive integer and offset must be a non-negative integer')
      err.status = 400
      return next(err)
    }
    const { email } = req.params
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json([])
    }
    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        category: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/category/:categoryName', async (req, res, next) => {
  try {
    const { limit, offset, err: pageErr } = parsePagination(req.query)
    if (pageErr) {
      const err = new Error('limit must be a positive integer and offset must be a non-negative integer')
      err.status = 400
      return next(err)
    }
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
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        category: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    res.json(notes)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(id)) {
      const err = new Error('Note not found')
      err.status = 404
      return next(err)
    }
    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        category: true
      }
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

router.post('/', noteSubmitLimiter, async (req, res, next) => {
  try {
    const { email, name, title, body, categoryId } = req.body

    if (!email || !name || !title || !body || !categoryId) {
      const err = new Error('email, name, title, body, and categoryId are required')
      err.status = 400
      return next(err)
    }

    if (title.length > 200) {
      const err = new Error('title must be 200 characters or fewer')
      err.status = 400
      return next(err)
    }

    if (body.length > 10000) {
      const err = new Error('body must be 10000 characters or fewer')
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

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name }
    })

    const note = await prisma.note.create({
      data: { title, body, userId: user.id, categoryId: category.id },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        category: true
      }
    })

    res.status(201).json(note)
  } catch (err) {
    next(err)
  }
})

router.limiter = noteSubmitLimiter
module.exports = router
