import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import { searchHandler, getAllHandler, createHandler, bulkCreateHandler, updateHandler, photoHandler } from './materials.controller'

const router = Router()

// Serwowanie zdjęć — bez autoryzacji (URL zawiera unikalną nazwę pliku)
router.get('/photo/:filename', photoHandler)

router.use(authenticate)

// Wyszukiwanie — GET /materials?q=...  (min 3 znaki; bez q → ostatnio używane)
router.get('/',       searchHandler)

// Admin: lista wszystkich, dodawanie, edycja
router.get('/all',            authorize('admin'), getAllHandler)
router.post('/',              authorize('admin'), createHandler)
router.post('/bulk',          authorize('admin'), bulkCreateHandler)
router.patch('/:id',          authorize('admin'), updateHandler)

export default router
