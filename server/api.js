import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/downloads/audio'))
  },
  filename: function (req, file, cb) {
    // Keep the original filename
    cb(null, file.originalname)
  }
})

const upload = multer({ storage: storage })

// API endpoint to save audio files
router.post('/save-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  res.json({ success: true, filename: req.file.filename })
})

export default router
