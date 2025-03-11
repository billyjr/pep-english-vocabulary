import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import apiRouter from './api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const port = 3000

// Enable CORS for development
app.use(cors())

// Serve static files from the dist directory (built Vue app)
app.use(express.static(path.join(__dirname, '../dist')))

// Serve audio files from the downloads directory
app.use('/downloads', express.static(path.join(__dirname, '../public/downloads')))

// Use API routes
app.use('/api', apiRouter)

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something broke!' })
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Audio files will be served from: ${path.join(__dirname, '../public/downloads/audio')}`)
})
