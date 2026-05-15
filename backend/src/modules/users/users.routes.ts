import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import { getAllHandler, getByIdHandler, createHandler, updateHandler, getMyStatsHandler } from './users.controller'

const router = Router()

router.use(authenticate)

router.get('/me/stats', getMyStatsHandler)

router.use(authorize('admin'))

router.get('/', getAllHandler)
router.get('/:id', getByIdHandler)
router.post('/', createHandler)
router.patch('/:id', updateHandler)

export default router
