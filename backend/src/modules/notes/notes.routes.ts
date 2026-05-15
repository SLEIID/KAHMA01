import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { listHandler, createHandler, updateHandler, removeHandler } from './notes.controller'

const router = Router()
router.use(authenticate)

router.get   ('/',     listHandler)
router.post  ('/',     createHandler)
router.patch ('/:id',  updateHandler)
router.delete('/:id',  removeHandler)

export default router
