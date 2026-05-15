import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { listHandler, createHandler, updateHandler } from './locations.controller'

const router = Router()

router.use(authenticate)

router.get('/',       listHandler)
router.post('/',      createHandler)
router.patch('/:id',  updateHandler)

export default router
