import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'materials')

// Upewnij się że katalog istnieje
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const rand = crypto.randomBytes(8).toString('hex')
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${Date.now()}-${rand}${ext}`)
  },
})

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Dozwolone tylko pliki graficzne'))
  }
}

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB (frontend kompresuje do ~100-300 KB)
}).single('photo')
