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
