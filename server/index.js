import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import apiRouter from './api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const port = 3000

// Enable CORS
app.use(cors())

// Serve static files from the public directory
app.use('/downloads', express.static(path.join(__dirname, '../public/downloads')))

// Use API routes
app.use('/api', apiRouter)

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something broke!' })
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Audio files will be served from: ${path.join(__dirname, '../public/downloads/audio')}`)
})
