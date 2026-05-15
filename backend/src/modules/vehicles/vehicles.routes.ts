import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import { getAllHandler, createHandler, updateHandler, deleteHandler } from './vehicles.controller'

const router = Router()

router.use(authenticate)
router.get('/', getAllHandler)                              // wszyscy zalogowani
router.post('/', authorize('admin'), createHandler)        // tylko admin
router.patch('/:id',  authorize('admin'), updateHandler)   // tylko admin
router.delete('/:id', authorize('admin'), deleteHandler)  // tylko admin

export default router
