const jwt = require('jsonwebtoken')

function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Unauthorized')
    err.status = 401
    return next(err)
  }
  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: decoded.id, email: decoded.email }
    next()
  } catch {
    const err = new Error('Unauthorized')
    err.status = 401
    next(err)
  }
}

module.exports = authenticate
