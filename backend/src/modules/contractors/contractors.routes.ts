import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import { listHandler, getByIdHandler, createHandler, updateHandler } from './contractors.controller'

const router = Router()

router.use(authenticate)
router.use(authorize('admin'))

router.get('/',     listHandler)
router.get('/:id',  getByIdHandler)
router.post('/',    createHandler)
router.patch('/:id', updateHandler)

export default router
