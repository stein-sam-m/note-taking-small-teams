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
    let { name } = req.body
    name = name ? name.trim() : name
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
