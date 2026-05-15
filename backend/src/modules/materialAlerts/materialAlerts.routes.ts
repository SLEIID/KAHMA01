import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { createHandler, listHandler, updateHandler } from './materialAlerts.controller'

const router = Router()

router.use(authenticate)

router.get('/',      listHandler)
router.post('/',     createHandler)   // multipart/form-data (multer inside controller)
router.patch('/:id', updateHandler)

export default router
