import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize }    from '../../middleware/authorize'
import { listHandler, createHandler, updateHandler } from './departments.controller'

const router = Router()
router.use(authenticate)

router.get  ('/',     listHandler)
router.post ('/',     createHandler)
router.patch('/:id',  authorize('admin'), updateHandler)

export default router
