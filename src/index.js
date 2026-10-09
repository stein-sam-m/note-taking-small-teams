require('dotenv').config()
const express = require('express')
const authRouter = require('./routes/auth')
const categoriesRouter = require('./routes/categories')
const notesRouter = require('./routes/notes')
const errorHandler = require('./middleware/errorHandler')

const app = express()
app.use(express.json())

app.use('/auth', authRouter)
app.use('/', categoriesRouter)
app.use('/notes', notesRouter)

app.use(errorHandler)

if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
