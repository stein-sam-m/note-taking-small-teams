const { Router } = require('express')
const prisma = require('../lib/prisma')

const router = Router()

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
