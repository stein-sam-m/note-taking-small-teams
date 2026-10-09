const { Router } = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const router = Router()

router.post('/register', async (req, res, next) => {
  try {
    const { email, name, password } = req.body
    if (!email || !name || !password) {
      const err = new Error('email, name, and password are required')
      err.status = 400
      return next(err)
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      const err = new Error('Email already registered')
      err.status = 400
      return next(err)
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, name, password: hash }
    })
    res.status(201).json({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      const err = new Error('Invalid credentials')
      err.status = 401
      return next(err)
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      const err = new Error('Invalid credentials')
      err.status = 401
      return next(err)
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      const err = new Error('Invalid credentials')
      err.status = 401
      return next(err)
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET
    )
    res.json({ token })
  } catch (err) {
    next(err)
  }
})

module.exports = router
