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
